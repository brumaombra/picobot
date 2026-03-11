import { AgentSpec } from './agent-spec.js';
import { executeToolBatch } from '../tools/tool-executor.js';
import { RUNNING_STATUS, IDLE_STATUS, DONE_STATUS, FAILED_STATUS } from '../config.js';
import { delay, generateId } from '../utils/utils.js';

// Agent class
export class Agent {
    // Constructor
    constructor({ id = null, definition, squad, parent = null, sessionId = null, initialPrompt = '' } = {}) {
        // Validate the definition
        if (!(definition instanceof AgentSpec)) {
            throw new Error('Agent requires an AgentSpec.');
        }

        // Validate the squad instance
        if (!squad) {
            throw new Error('Agent requires a squad instance.');
        }

        // Initialize properties
        this.id = id || generateId(definition.id);
        this.definition = definition;
        this.squad = squad;
        this.parent = parent;
        this.sessionId = sessionId || this.id;
        this.initialPrompt = initialPrompt;
        this.status = IDLE_STATUS;
        this.startedAt = new Date();
        this.completedAt = null;
        this.result = null;
        this.error = null;
        this.subagents = new Map();
    }

    // Get the agent name
    get name() {
        return this.definition.name;
    }

    // Get the system prompt
    get prompt() {
        return this.squad.composePrompt(this);
    }

    // Get the names of allowed tools
    get allowedToolNames() {
        return [...this.definition.allowedTools];
    }

    // Get the model for this agent
    get model() {
        return this.definition.model || this.squad.model || null;
    }

    // Get all messages for the current session
    getMessages() {
        return this.squad.sessionStore.getMessages(this.sessionId);
    }

    // Append a message to the current session
    appendMessage(message) {
        this.squad.sessionStore.appendMessage(this.sessionId, message);
        return message;
    }

    // Get tool definitions formatted for the LLM API
    getToolDefinitions() {
        return this.listTools().map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }

    // Ensure the session has the initial system and user messages
    ensureSession() {
        // Create the session if not present
        const messages = this.getMessages();
        if (messages.length === 0) {
            // Add the system prompt
            this.appendMessage({
                role: 'system',
                content: this.prompt
            });

            // Add the initial user prompt if provided
            if (this.initialPrompt) {
                this.appendMessage({
                    role: 'user',
                    content: this.initialPrompt
                });
            }
        }

        // Return the session messages
        return this.squad.sessionStore.getOrCreateSession(this.sessionId);
    }

    // Send a message to the agent
    async send(content, { role = 'user' } = {}) {
        // Ensure the session is initialized
        this.ensureSession();
        this.status = RUNNING_STATUS;

        // Emit the message event
        this.squad.emitEvent('agentMessage', {
            agentId: this.id,
            agentType: this.definition.id,
            role,
            sessionId: this.sessionId
        });

        // Append the user message
        this.appendMessage({
            role,
            content: content || ''
        });

        // Return early if no LLM is configured
        if (!this.squad.llm) {
            return {
                agentId: this.id,
                sessionId: this.sessionId,
                response: null,
                messages: this.getMessages()
            };
        }

        // Run the main loop and return the result
        const result = await this.runLoop();

        // Return the final response along with all messages in the session
        return {
            agentId: this.id,
            sessionId: this.sessionId,
            response: result.response,
            finishReason: result.finishReason || null,
            timedOut: Boolean(result.timedOut),
            messages: this.getMessages()
        };
    }

    // Run the main agent loop
    async runLoop() {
        const startedAt = Date.now();
        let wrapUpInjected = false;
        let iteration = 0;

        // Loop until the agent completes or reaches its soft runtime deadline
        while (true) {
            iteration += 1;

            // Check for the soft runtime deadline and fail if exceeded
            const elapsed = Date.now() - startedAt;
            if (elapsed >= this.squad.maxRuntimeMs) {
                // Fail the agent and emit an error event
                this.fail(`Agent run deadline reached after ${this.squad.maxRuntimeMs} ms.`);
                this.squad.emitEvent('agentError', {
                    agentId: this.id,
                    agentType: this.definition.id,
                    sessionId: this.sessionId,
                    error: `Agent run deadline reached after ${this.squad.maxRuntimeMs} ms.`,
                    timedOut: true
                });

                // Return a structured timeout result so runtime layers can respond gracefully
                return {
                    response: null,
                    finishReason: 'deadline',
                    timedOut: true
                };
            }

            // Inject a warning message before the soft deadline to encourage the agent to wrap up
            const remaining = this.squad.maxRuntimeMs - elapsed;
            if (!wrapUpInjected && remaining <= this.squad.wrapUpThresholdMs) {
                wrapUpInjected = true;
                this.appendMessage({
                    role: 'system',
                    content: `TIME WARNING: You have approximately ${Math.ceil(remaining / 1000)} seconds remaining before this run times out. Start wrapping up your current work now, finish what you are doing, and avoid starting new complex operations.`
                });
            }

            // Emit the iteration event
            this.squad.emitEvent('agentIteration', {
                agentId: this.id,
                agentType: this.definition.id,
                iteration: iteration + 1,
                sessionId: this.sessionId
            });

            // Ask the LLM for the next response with retry support for transient failures
            const result = await this.runChatWithRetry();

            // Extract content and tool calls from the LLM response
            const content = result?.content || '';
            const toolCalls = Array.isArray(result?.tool_calls) ? result.tool_calls : [];

            // Append the assistant response
            this.appendMessage({
                role: 'assistant',
                content,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined
            });

            // Emit the assistant event
            this.squad.emitEvent('agentAssistant', {
                agentId: this.id,
                agentType: this.definition.id,
                toolCalls: toolCalls.length,
                hasContent: Boolean(content)
            });

            // Complete if there are no tool calls to execute
            if (toolCalls.length === 0) {
                // Mark the agent as completed
                this.complete(content || null);
                this.squad.emitEvent('agentComplete', {
                    agentId: this.id,
                    agentType: this.definition.id,
                    sessionId: this.sessionId
                });

                // Return the final response
                return {
                    response: content || null,
                    finishReason: result?.finish_reason || 'stop',
                    timedOut: false
                };
            }

            // Execute tool calls and append their messages
            const toolMessages = await executeToolBatch({
                agent: this,
                toolCalls
            });

            // Append tool response messages to the session
            for (const toolMessage of toolMessages) {
                this.appendMessage(toolMessage);
            }
        }
    }

    // Ask the LLM for the next response with retry support for transient failures
    async runChatWithRetry() {
        const maxRetries = this.squad.llmChatMaxRetries;
        
        // Retry loop for transient errors
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Call the LLM chat method
                return await this.squad.llm.chat(
                    this.getMessages(),
                    this.getToolDefinitions(),
                    this.model
                );
            } catch (error) {
                // If maximum number of retries reached, rethrow the error
                if (attempt >= maxRetries) {
                    throw error;
                }

                // Emit an agent retry event
                this.squad.emitEvent('agentRetry', {
                    agentId: this.id,
                    agentType: this.definition.id,
                    sessionId: this.sessionId,
                    attempt: attempt + 1,
                    error: error instanceof Error ? error.message : error
                });

                // Exponential backoff before retrying
                await delay((attempt + 1) * 250);
            }
        }
    }

    // Run the agent with optional input
    async run(input = null, options = {}) {
        // Run the loop directly if no input was provided
        if (input === null || input === undefined) {
            return this.runLoop();
        }

        // Otherwise send the input as a message
        return this.send(input, options);
    }

    // Mark the agent as completed
    complete(result = null) {
        this.status = DONE_STATUS;
        this.result = result;
        this.error = null;
        this.completedAt = new Date();
        return this;
    }

    // Mark the agent as failed
    fail(error) {
        this.status = FAILED_STATUS;
        this.result = null;
        this.error = error instanceof Error ? error.message : error;
        this.completedAt = new Date();
        return this;
    }

    // Get a tool available to this agent by name
    getTool(name) {
        const normalizedName = name;
        const builtInTool = this.squad.getBuiltInTool(normalizedName, this);

        // Prefer built-in tools
        if (builtInTool) {
            return builtInTool;
        }

        // Reject tools that are not allowed for this agent
        if (!this.definition.allowedTools.includes(normalizedName)) {
            return null;
        }

        // Return the registered external tool
        return this.squad.getTool(normalizedName);
    }

    // List all tools available to this agent
    listTools() {
        // Get all external tools
        const externalTools = this.definition.allowedTools
            .map(toolName => this.squad.getTool(toolName))
            .filter(Boolean);

        // Combine built-in tools with allowed external tools
        return [...this.squad.listBuiltInTools(this), ...externalTools];
    }

    // Spawn a subagent
    spawnSubagent(type, { prompt = '' } = {}) {
        // Look up the subagent definition
        const definition = this.squad.getAgentSpec(type);
        if (!definition) {
            const available = this.squad.listSubagentSpecs().map(agent => agent.id).join(', ');
            throw new Error(`Unknown subagent "${type}". Available subagents: ${available}`);
        }

        // Create the child agent
        const agent = new Agent({
            definition,
            squad: this.squad,
            parent: this,
            initialPrompt: prompt
        });

        // Initialize the child session and register it
        agent.ensureSession();
        this.subagents.set(agent.id, agent);

        // Emit the spawn event
        this.squad.emitEvent('agentSpawn', {
            parentAgentId: this.id,
            parentAgentType: this.definition.id,
            agentId: agent.id,
            agentType: agent.definition.id,
            sessionId: agent.sessionId
        });

        // Return the child agent
        return agent;
    }

    // Get a subagent by id
    getSubagent(agentId) {
        return this.subagents.get(agentId);
    }

    // List direct child subagents
    listSubagents() {
        return [...this.subagents.values()];
    }

    // List all descendant subagents recursively
    listDescendants() {
        const descendants = [];

        // Recursively collect descendants from subagents
        for (const agent of this.subagents.values()) {
            descendants.push(agent);
            descendants.push(...agent.listDescendants());
        }

        // Return the list of descendants
        return descendants;
    }

    // Find an agent by id in this subtree
    findById(agentId) {
        // Check if the current agent matches the id
        if (this.id === agentId) {
            return this;
        }

        // Recursively search subagents for a matching id
        for (const agent of this.subagents.values()) {
            const match = agent.findById(agentId);
            if (match) {
                return match;
            }
        }

        // Return null if no match is found
        return null;
    }

    // Find an agent by session id in this subtree
    findBySessionId(sessionId) {
        // Check if the current agent's session id matches
        if (this.sessionId === sessionId) {
            return this;
        }

        // Recursively search subagents for a matching session id
        for (const agent of this.subagents.values()) {
            const match = agent.findBySessionId(sessionId);
            if (match) {
                return match;
            }
        }

        // Return null if no match is found
        return null;
    }
}