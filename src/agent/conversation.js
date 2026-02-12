import { getSessionMessages, addMessageToSession } from '../session/manager.js';
import { logger } from '../utils/logger.js';
import { MAX_AGENT_ITERATIONS } from '../config.js';
import { ToolExecutor } from './tool-executor.js';
import { getToolsDefinitions } from '../tools/tools.js';

// Merge base tools with routed category tools, ensuring no duplicates
const mergeTools = (baseTools, baseToolNames, categoryKeys) => {
    // If no categories to route, return base tools as-is
    if (!categoryKeys?.length) return baseTools;

    // Get tools for the routed categories and merge with base tools, avoiding duplicates
    const routedDefs = getToolsDefinitions({ categories: categoryKeys });
    const merged = [...baseTools];
    const seen = new Set(baseToolNames);

    // Add routed tools that are not already in the base set
    for (const def of routedDefs) {
        const name = def?.function?.name;
        if (!name || seen.has(name)) continue;
        seen.add(name);
        merged.push(def);
    }

    // Return the merged tool definitions
    return merged;
};

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
        let routedCategories = []; // Accumulated routed categories for this run

        // Preserve the original allowed tool set for this run (important for exclude-lists, e.g. subagent recursion prevention)
        const baseTools = Array.isArray(tools) ? tools : [];
        const baseToolNames = new Set(baseTools.map(tool => tool?.function?.name).filter(Boolean));

        // Main conversation loop
        while (iteration < MAX_AGENT_ITERATIONS) {
            // Increment iteration
            iteration++;
            logger.debug(`Conversation iteration ${iteration}/${MAX_AGENT_ITERATIONS}`);

            // Get current messages
            const messages = getSessionMessages(sessionKey);

            // Build tools for this iteration (base tools + any routed categories)
            let currentTools = baseTools || [];
            if (routedCategories.length > 0) {
                currentTools = mergeTools(baseTools, baseToolNames, routedCategories);
                logger.debug(`Using expanded tools with categories: ${routedCategories.join(', ')}`);
            }

            // Compute allowed tool names for this iteration (used to enforce routing at execution time)
            const allowedToolNames = new Set(currentTools.map(tool => tool?.function?.name).filter(Boolean));

            // Call the LLM with current tools
            const result = await this.llm.chat(messages, currentTools, this.model);

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

                    // Expand tools if addTools is present (from route_to_category)
                    if (message.addTools?.categories) {
                        for (const category of message.addTools.categories) {
                            if (!routedCategories.includes(category)) {
                                routedCategories.push(category);
                                logger.debug(`Routed to category: ${category}`);
                            }
                        }
                    }
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
}