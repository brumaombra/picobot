import { AgentSpec } from './agent-spec.js';
import { executeToolBatch } from '../tools/tool-executor.js';
import { RUNNING_STATUS, IDLE_STATUS, DONE_STATUS, FAILED_STATUS } from '../config.js';
import { delay, generateId } from '../utils/utils.js';
import { onRuntimeMessage, sendRuntimeMessage, startRuntime, stopRuntime } from '../runtime/channel.js';
import { onRuntimeEvent, emitRuntimeEvent } from '../runtime/events.js';
import { composePrompt, getTool } from '../runtime/lookup.js';
import { askMainAgent, chatSubagent, launchSubagent, listActiveSubagents, spawnSubagent } from '../runtime/subagents.js';

// Agent class
export class Agent {
    // Constructor
    constructor({ id = null, definition, runtime, parent = null, sessionId = null, initialPrompt = '' } = {}) {
        // Validate the definition
        if (!(definition instanceof AgentSpec)) {
            throw new Error('Agent requires an AgentSpec.');
        }

        // Validate the runtime object
        if (!runtime) {
            throw new Error('Agent requires a runtime object.');
        }

        // Initialize properties
        this.id = id || generateId(definition.id);
        this.definition = definition;
        this.runtime = runtime;
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
        return composePrompt(this.runtime, this);
    }

    // Get the model for this agent
    get model() {
        return this.definition.model || this.runtime.model || null;
    }

    // Get the session manager backing this agent runtime
    get sessionManager() {
        return this.runtime.sessionManager || null;
    }

    // Register how inbound channel messages should be forwarded into the runtime
    onMessage(handler) {
        onRuntimeMessage(this.runtime, handler);
        return this;
    }

    // Register how outbound assistant messages should be sent to the channel
    sendMessage(handler) {
        sendRuntimeMessage(this.runtime, handler);
        return this;
    }

    // Register a runtime event handler
    on(eventId, handler) {
        return onRuntimeEvent(this.runtime, eventId, handler);
    }

    // Start the background chat runtime loop
    async start() {
        await startRuntime(this.runtime);
        return this;
    }

    // Stop the background chat runtime loop
    async stop() {
        return stopRuntime(this.runtime);
    }

    // Get all messages for the current session
    getMessages() {
        return this.sessionManager.getMessages(this.sessionId);
    }

    // Append a message to the current session
    appendMessage(message) {
        this.sessionManager.appendMessage(this.sessionId, message);
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
        return this.sessionManager.getOrCreateSession(this.sessionId);
    }

    // Send a message to the agent
    async send(content, { role = 'user' } = {}) {
        // Ensure the session is initialized
        this.ensureSession();
        this.status = RUNNING_STATUS;

        // Emit the message event
        emitRuntimeEvent(this.runtime, 'agentMessage', {
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
        if (!this.runtime.llm) {
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

        try {
            // Loop until the agent completes or reaches its soft runtime deadline
            while (true) {
                iteration += 1;

                // Check for the soft runtime deadline and fail if exceeded
                const elapsed = Date.now() - startedAt;
                if (elapsed >= this.runtime.maxRuntimeMs) {
                    // Fail the agent and emit an error event
                    this.fail(`Agent run deadline reached after ${this.runtime.maxRuntimeMs} ms.`);
                    emitRuntimeEvent(this.runtime, 'agentError', {
                        agentId: this.id,
                        agentType: this.definition.id,
                        sessionId: this.sessionId,
                        error: `Agent run deadline reached after ${this.runtime.maxRuntimeMs} ms.`,
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
                const remaining = this.runtime.maxRuntimeMs - elapsed;
                if (!wrapUpInjected && remaining <= this.runtime.wrapUpThresholdMs) {
                    wrapUpInjected = true;
                    this.appendMessage({
                        role: 'system',
                        content: `TIME WARNING: You have approximately ${Math.ceil(remaining / 1000)} seconds remaining before this run times out. Start wrapping up your current work now, finish what you are doing, and avoid starting new complex operations.`
                    });
                }

                // Emit the iteration event
                emitRuntimeEvent(this.runtime, 'agentIteration', {
                    agentId: this.id,
                    agentType: this.definition.id,
                    iteration,
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
                emitRuntimeEvent(this.runtime, 'agentAssistant', {
                    agentId: this.id,
                    agentType: this.definition.id,
                    toolCalls: toolCalls.length,
                    hasContent: Boolean(content)
                });

                // Complete if there are no tool calls to execute
                if (toolCalls.length === 0) {
                    // Mark the agent as completed
                    this.complete(content || null);
                    emitRuntimeEvent(this.runtime, 'agentComplete', {
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
        } catch (error) {
            // Mark the agent as failed and emit an error event
            this.fail(error);
            emitRuntimeEvent(this.runtime, 'agentError', {
                agentId: this.id,
                agentType: this.definition.id,
                sessionId: this.sessionId,
                error: error instanceof Error ? error.message : String(error),
                timedOut: false
            });

            // Throw the error
            throw error;
        }
    }

    // Ask the LLM for the next response with retry support for transient failures
    async runChatWithRetry() {
        const maxRetries = this.runtime.llmChatMaxRetries;

        // Retry loop for transient errors
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Call the LLM chat method
                return await this.runtime.llm.chat(
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
                emitRuntimeEvent(this.runtime, 'agentRetry', {
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
        // Check if the tool is allowed for this agent
        if (!this.definition.allowedTools.includes(name)) {
            return null;
        }

        // Resolve the tool from the runtime tool registry
        const tool = getTool(this.runtime, name);
        if (!tool) {
            throw new Error(`Allowed tool "${name}" could not be resolved for agent "${this.definition.id}".`);
        }

        // Return the resolved tool
        return tool;
    }

    // List all tools available to this agent
    listTools() {
        return this.definition.allowedTools.map(toolName => this.getTool(toolName));
    }

    // Spawn a subagent
    async spawnSubagent(type, { prompt = '' } = {}) {
        return spawnSubagent(this, type, { prompt });
    }

    // Launch a subagent in the background and return immediately with its metadata
    async launchSubagent(type, prompt = '') {
        return launchSubagent(this, type, prompt);
    }

    // Ask the leader agent a question from inside a running subagent and wait for the reply
    askMainAgent(question) {
        return askMainAgent(this, question);
    }

    // Chat with a tracked subagent by id, either answering a pending question or resuming its session
    async chatSubagent(subagentId, message) {
        return chatSubagent(this, subagentId, message);
    }

    // List all currently active subagents for the current leader session
    listActiveSubagents() {
        return listActiveSubagents(this);
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