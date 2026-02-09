import { getSessionMessages, addMessageToSession } from '../session/manager.js';
import { logger } from '../utils/logger.js';
import { MAX_AGENT_ITERATIONS } from '../config.js';
import { ToolExecutor } from './tool-executor.js';
import { getToolsDefinitions } from '../tools/tools.js';

// Conversation manager class
export class ConversationManager {
    // Create a new conversation manager instance
    constructor({ llm, model }) {
        // Validate required dependencies
        if (!llm || !model) {
            throw new Error('LLM and model are required');
        }

        // Store dependencies
        this.llm = llm;
        this.model = model;
        this.toolExecutor = new ToolExecutor();
    }

    // Run a conversation loop with the LLM
    async run(sessionKey, tools, context, onIntermediateMessage) {
        let iteration = 0;
        let finalResponse = null;
        let nextIterationCategories = []; // Categories to add for next iteration only

        // Main conversation loop
        while (iteration < MAX_AGENT_ITERATIONS) {
            // Increment iteration
            iteration++;
            logger.debug(`Conversation iteration ${iteration}/${MAX_AGENT_ITERATIONS}`);

            // Get current messages
            const messages = getSessionMessages(sessionKey);

            // Build tools for this iteration (base tools + any active categories)
            let currentTools = tools;
            if (nextIterationCategories.length > 0) {
                currentTools = getToolsDefinitions({ categories: ['general', ...nextIterationCategories] });
                logger.debug(`Using expanded tools with categories: ${nextIterationCategories.join(', ')}`);
            }

            // Call the LLM with current tools
            const result = await this.llm.chat(messages, currentTools, this.model);

            // Add assistant message to history
            addMessageToSession(sessionKey, {
                role: 'assistant',
                content: result.content || '',
                tool_calls: result.tool_calls.length > 0 ? result.tool_calls : undefined
            });

            // Handle different response types
            if (result.content && result.tool_calls.length === 0) { // Content only - final response
                finalResponse = result.content;
                break;
            } else if (result.content && result.tool_calls.length > 0) { // Content with tool calls - send intermediate message
                if (onIntermediateMessage) {
                    onIntermediateMessage(result.content);
                }
            }

            // Execute tool calls if present
            if (result.tool_calls.length > 0) {
                // Execute all tool calls in parallel
                const toolResults = await this.toolExecutor.executeBatch(result.tool_calls, context);

                // Process each tool result
                for (const message of toolResults) {
                    // Add tool result to session
                    addMessageToSession(sessionKey, {
                        role: message.role,
                        content: message.content,
                        tool_call_id: message.tool_call_id
                    });

                    // Expand tools if addTools is present (from route_to_category)
                    if (message.addTools?.categories) {
                        // Queue categories for next iteration only
                        for (const category of message.addTools.categories) {
                            if (!nextIterationCategories.includes(category)) {
                                nextIterationCategories.push(category);
                                logger.debug(`Queuing tools from category for next iteration: ${category}`);
                            }
                        }
                    }
                }
            }

            // Check if we should stop
            if (result.finish_reason === 'stop' && result.tool_calls.length === 0) {
                break;
            }
        }

        // Return conversation result
        return {
            response: finalResponse,
            reachedMaxIterations: iteration >= MAX_AGENT_ITERATIONS
        };
    }
}