import { cleanupSessions, getSessionMessages, addMessageToSession } from '../session/manager.js';
import { logger } from '../utils/logger.js';
import { pullInbound } from '../bus/message-bus.js';
import { QUEUE_POLL_TIMEOUT_MS, SESSION_CLEANUP_INTERVAL_MS, MAX_AGENT_ITERATIONS } from '../config.js';
import { MessageProcessor } from './message-processor.js';
import { ToolExecutor } from './tool-executor.js';

// Agent class — used for both the main agent and subagents
export class Agent {
    // Create a new agent instance
    constructor({ llm, model, workspacePath, config, isSubagent = false } = {}) {
        // Validate required dependencies
        if (!llm || !model) {
            throw new Error('LLM and model are required');
        }

        // Store core dependencies
        this.llm = llm;
        this.model = model;
        this.isSubagent = isSubagent;
        this.toolExecutor = new ToolExecutor();

        // Initialize the message processor (main agent only — subagents don't need it)
        if (!this.isSubagent) {
            this.messageProcessor = new MessageProcessor({
                agent: this,
                workspacePath,
                config
            });
        }

        // Agent state
        this.running = false;
    }

    // Run a conversation loop with the LLM
    async run(sessionKey, tools, context, onIntermediateMessage) {
        let iteration = 0;
        let finalResponse = null;

        // Resolve tool definitions and compute allowed tool names
        const toolDefs = Array.isArray(tools) ? tools : [];
        const allowedToolNames = new Set(toolDefs.map(tool => tool?.function?.name).filter(Boolean));

        // Main conversation loop
        while (iteration < MAX_AGENT_ITERATIONS) {
            // Increment iteration
            iteration++;
            logger.debug(`Conversation iteration ${iteration}/${MAX_AGENT_ITERATIONS}`);

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
                const toolResults = await this.toolExecutor.executeBatch(toolCalls, context, allowedToolNames);

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
        return {
            response: finalResponse,
            reachedMaxIterations: !finalResponse && iteration >= MAX_AGENT_ITERATIONS
        };
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
                const message = await pullInbound(QUEUE_POLL_TIMEOUT_MS);
                if (message) {
                    await this.messageProcessor.process(message);
                }
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