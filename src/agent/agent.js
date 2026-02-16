import { cleanupSessions, getOrCreateSession, getSessionMessages, addMessageToSession } from '../session/manager.js';
import { logger } from '../utils/logger.js';
import { formatTime, generateUniqueId } from '../utils/utils.js';
import { pullInbound, sendOutbound, pushInbound } from '../bus/message-bus.js';
import { QUEUE_POLL_TIMEOUT_MS, SESSION_CLEANUP_INTERVAL_MS, AGENT_TIME_LIMIT_MS, AGENT_WRAPUP_THRESHOLD_MS } from '../config.js';
import { getToolsDefinitions } from '../tools/tools.js';
import { buildSystemPrompt, buildSubagentSystemPrompt, getMainAgentAllowedTools } from './prompts.js';
import { executeToolBatch } from './tool-executor.js';
import { getAgent, getAgents } from './agents.js';
import { TaskRegistry } from './task-registry.js';

// Agent class — used for both the main agent and subagents
export class Agent {
    // Create a new agent instance
    constructor({ llm, model, workspacePath, config } = {}) {
        // Validate required dependencies
        if (!llm || !model) {
            throw new Error('LLM and model are required');
        }

        // Store core dependencies
        this.llm = llm;
        this.model = model;

        // Main agent configuration (only needed for start())
        this.workspacePath = workspacePath;
        this.config = config;

        // Agent state
        this.running = false;

        // Cached tool definitions (computed on first access)
        this._mainToolDefs = null;

        // Task registry for tracking subagent tasks (only used by main agent)
        this.taskRegistry = new TaskRegistry();
    }

    // Cached main agent tool definitions
    get mainToolDefs() {
        // Generate list if not cached
        if (!this._mainToolDefs) {
            this._mainToolDefs = getToolsDefinitions(getMainAgentAllowedTools());
        }

        // Return cached definitions
        return this._mainToolDefs;
    }

    // Build execution context with optional overrides
    buildContext(overrides = {}) {
        return {
            workingDir: this.workspacePath,
            llm: this.llm,
            model: this.model,
            config: this.config,
            taskRegistry: this.taskRegistry,
            launchSubagent: (agentId, task, existingTaskId, sessionKey) => {
                return this.launchSubagent(agentId, task, existingTaskId, sessionKey);
            },
            ...overrides
        };
    }

    // Run a conversation loop with the LLM
    async run(sessionKey, tools, context, onIntermediateMessage) {
        let iteration = 0;
        let finalResponse = null;
        let wrapUpInjected = false;

        // Time-based limit
        const startTime = Date.now();

        // Resolve tool definitions and compute allowed tool names
        const toolDefs = Array.isArray(tools) ? tools : [];
        const allowedToolNames = new Set(toolDefs.map(tool => tool?.function?.name).filter(Boolean));

        // Main conversation loop
        while (true) {
            // Check time limit
            const elapsed = Date.now() - startTime;
            if (elapsed >= AGENT_TIME_LIMIT_MS) {
                logger.warn(`Time limit reached (${formatTime(AGENT_TIME_LIMIT_MS)}) for session ${sessionKey}`);
                break;
            }

            // Inject wrap-up warning when approaching time limit
            const remaining = AGENT_TIME_LIMIT_MS - elapsed;
            if (!wrapUpInjected && remaining <= AGENT_WRAPUP_THRESHOLD_MS) {
                wrapUpInjected = true;
                logger.info(`Injecting wrap-up warning (${formatTime(remaining)} remaining) for session ${sessionKey}`);
                addMessageToSession(sessionKey, {
                    role: 'system',
                    content: `⏰ TIME WARNING: You have approximately ${formatTime(remaining)} remaining before your execution time runs out. Start wrapping up your current work now. Finish what you're doing, and avoid starting any new complex operations.`
                });
            }

            // Increment iteration
            iteration++;
            logger.debug(`Conversation iteration ${iteration} (${formatTime(elapsed)} / ${formatTime(AGENT_TIME_LIMIT_MS)})`);

            // Get current messages
            const messages = getSessionMessages(sessionKey);

            // Call the LLM with current tools
            const result = await this.llm.chat(messages, toolDefs, this.model);

            // Extract content and tool calls from the result
            const content = typeof result?.content === 'string' ? result.content : '';
            const toolCalls = Array.isArray(result?.tool_calls) ? result.tool_calls : [];

            // Add assistant message to history
            addMessageToSession(sessionKey, {
                role: 'assistant',
                content,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined
            });

            // Handle different response types
            if (content && toolCalls.length === 0) { // Content only - final response
                finalResponse = content;
                break;
            } else if (content && toolCalls.length > 0) { // Content with tool calls - send intermediate message
                if (onIntermediateMessage) {
                    onIntermediateMessage(content);
                }
            }

            // Execute tool calls if present
            if (toolCalls.length > 0) {
                // Execute all tool calls in parallel
                const toolResults = await executeToolBatch(toolCalls, context, allowedToolNames);

                // Process each tool result
                for (const message of toolResults) {
                    // Add tool result to session
                    addMessageToSession(sessionKey, {
                        role: message.role,
                        content: message.content,
                        tool_call_id: message.tool_call_id
                    });
                }
            }

            // Handle empty response (no content, no tool calls) — treat as completion
            if (!content && toolCalls.length === 0) {
                logger.warn(`Empty LLM response at iteration ${iteration}, treating as completion`);
                break;
            }
        }

        // Return conversation result
        const timedOut = !finalResponse && (Date.now() - startTime) >= AGENT_TIME_LIMIT_MS;
        return {
            response: finalResponse,
            timedOut
        };
    }

    // Process a single inbound message (main agent only)
    async processMessage(message) {
        logger.info(`Processing message for session ${message.sessionKey}`);

        try {
            // Build context
            const context = this.buildContext({ sessionKey: message.sessionKey });

            // Run unified task flow
            const result = await this.runTask({
                sessionKey: message.sessionKey,
                systemPromptBuilder: () => buildSystemPrompt(),
                userMessage: message.content,
                messageRole: message.role || 'user',
                tools: this.mainToolDefs,
                context,
                onIntermediateMessage: content => sendOutbound({ sessionKey: message.sessionKey, content })
            });

            // Send final response or timeout message
            if (result.response) {
                sendOutbound({ sessionKey: message.sessionKey, content: result.response });
            } else if (result.timedOut) {
                logger.warn(`Time limit reached for session ${message.sessionKey}`);
                sendOutbound({
                    sessionKey: message.sessionKey,
                    content: "I've run out of time for this task. Let me know if you'd like me to continue!"
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error processing message: ${errorMessage}`);
            sendOutbound({
                sessionKey: message.sessionKey,
                content: `Sorry, I encountered an error: ${errorMessage}`
            });
        }
    }

    // Unified method to bootstrap a session and run a conversation
    async runTask({ sessionKey, systemPromptBuilder, userMessage, messageRole = 'user', tools, context, onIntermediateMessage }) {
        // Initialize session with system prompt if needed
        const session = getOrCreateSession(sessionKey);
        if (session.messages.length === 0) {
            const systemPrompt = systemPromptBuilder();
            addMessageToSession(sessionKey, { role: 'system', content: systemPrompt });
        }

        // Add message to session with the specified role
        addMessageToSession(sessionKey, { role: messageRole, content: userMessage });

        // Run the conversation loop
        return this.run(sessionKey, tools, context, onIntermediateMessage);
    }

    // Launch a subagent in the background (fire-and-forget), returns immediately with task ID
    launchSubagent(agentId, task, existingTaskId, parentSessionKey) {
        // Look up agent definition
        const agentDef = getAgent(agentId);
        if (!agentDef) {
            const available = [...getAgents().keys()].join(', ');
            throw new Error(`Unknown agent "${agentId}". Available agents: ${available}`);
        }

        // Determine task ID and session (resume existing or create new)
        const existingTask = existingTaskId ? this.taskRegistry.get(existingTaskId) : null;
        if (existingTaskId && !existingTask) {
            throw new Error(`Unknown task_id "${existingTaskId}". Use check_subagent to list all tasks.`);
        }
        const taskId = existingTaskId || generateUniqueId('task');
        const subagentId = existingTask?.sessionId || generateUniqueId('subagent');
        const isResuming = Boolean(existingTaskId);

        logger.info(`${isResuming ? 'Resuming' : 'Spawning'} subagent [${subagentId}] task [${taskId}]: ${agentDef.name} (model: ${this.model})`);

        // Register the task before launching
        this.taskRegistry.register(taskId, { agentId, agentName: agentDef.name, sessionId: subagentId, task });

        // Create subagent and launch in the background
        const subagent = new Agent({ llm: this.llm, model: this.model });
        const toolDefs = getToolsDefinitions(agentDef.allowedTools);
        const context = this.buildContext({ sessionKey: parentSessionKey });

        // Run the subagent task without awaiting it, and handle completion/failure in the promise chain
        subagent.runTask({
            sessionKey: subagentId,
            systemPromptBuilder: () => buildSubagentSystemPrompt(agentDef),
            userMessage: task,
            tools: toolDefs,
            context
        }).then(result => {
            logger.info(`Subagent [${subagentId}] task [${taskId}] completed: ${agentDef.name}`);
            const status = result.response ? 'completed' : 'failed';

            // Update task registry with result
            if (result.response) {
                this.taskRegistry.complete(taskId, result.response);
            } else {
                this.taskRegistry.fail(taskId, result.timedOut ? 'Subagent timed out without completing the task.' : 'Subagent completed without producing a response.');
            }

            // Notify parent session of completion
            pushInbound({
                sessionKey: parentSessionKey,
                role: 'system',
                content: JSON.stringify({
                    type: 'subagent_notification',
                    event: 'completed',
                    task_id: taskId,
                    agent: agentDef.name,
                    agent_id: agentId,
                    status,
                    message: 'Subagent task completed. Use check_subagent to retrieve the full result.'
                })
            });
        }).catch(error => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Subagent [${subagentId}] task [${taskId}] failed: ${errorMessage}`);
            this.taskRegistry.fail(taskId, errorMessage);

            // Notify parent session of failure
            pushInbound({
                sessionKey: parentSessionKey,
                role: 'system',
                content: JSON.stringify({
                    type: 'subagent_notification',
                    event: 'failed',
                    task_id: taskId,
                    agent: agentDef.name,
                    agent_id: agentId,
                    error: errorMessage,
                    message: 'Subagent task failed. Use check_subagent to see details.'
                })
            });
        });

        return { taskId, agentName: agentDef.name };
    }

    // Start the main agent polling loop
    async start() {
        // Set running flag
        this.running = true;
        logger.info('Agent loop started');

        // Clean up sessions periodically
        const cleanupInterval = setInterval(() => {
            cleanupSessions();
        }, SESSION_CLEANUP_INTERVAL_MS);

        // Main loop
        while (this.running) {
            try {
                // Pull a message from the inbound queue with timeout
                const message = await pullInbound(QUEUE_POLL_TIMEOUT_MS);
                if (!message) {
                    continue; // If no message was received, loop again
                }

                // Process one message at a time in queue order
                await this.processMessage(message);
            } catch (error) {
                logger.error(`Agent loop error: ${error}`);
            }
        }

        // Clear cleanup interval
        clearInterval(cleanupInterval);
        logger.info('Agent loop stopped');
    }

    // Stop the agent loop
    stop() {
        this.running = false;
    }
}