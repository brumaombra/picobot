import { getTool } from '../tools/tools.js';
import { logger } from '../utils/logger.js';
import { parseJson, stringifyJson } from '../utils/utils.js';

// Tool executor class
export class ToolExecutor {
    // Create a new tool executor instance
    constructor() {
        // No dependencies needed
    }

    // Execute a single tool call
    async execute(toolCall, context) {
        // Find the tool
        const tool = getTool(toolCall.function.name);
        if (!tool) {
            // Unknown tool - return error message
            logger.warn(`Unknown tool: ${toolCall.function.name}`);
            return {
                role: 'tool',
                content: `Error: Unknown tool "${toolCall.function.name}"`,
                tool_call_id: toolCall.id
            };
        }

        try {
            // Parse arguments
            const args = parseJson(toolCall.function.arguments);

            // Execute the tool
            logger.debug(`Executing tool: ${toolCall.function.name}`);
            const result = await tool.execute(args, context);

            // Create tool message with result
            let content;
            if (result.success) {
                // If output is a string, send it directly, if it's structured data, stringify it
                if (typeof result.output === 'string') {
                    content = result.output;
                } else {
                    content = stringifyJson(result.output);
                }
            } else {
                content = `Error: ${result.error || 'Unknown error'}`;
            }

            // Log tool result
            logger.debug(`Tool ${toolCall.function.name} executed`);

            // Return tool message with optional addTools for expanding tool availability
            const response = {
                role: 'tool',
                content,
                tool_call_id: toolCall.id
            };

            // Include addTools if present (for route_to_category tool)
            if (result.addTools) {
                response.addTools = result.addTools;
            }

            // Return the tool execution result
            return response;
        } catch (error) {
            // Log execution error
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Tool execution error: ${message}`);

            // Return error message
            return {
                role: 'tool',
                content: `Error executing tool: ${message}`,
                tool_call_id: toolCall.id
            };
        }
    }

    // Execute multiple tool calls in parallel
    async executeBatch(toolCalls, context) {
        const settled = await Promise.allSettled(
            toolCalls.map(call => this.execute(call, context))
        );

        // Map settled results, converting any unexpected rejections to error messages
        return settled.map((result, i) => {
            if (result.status === 'fulfilled') return result.value;
            const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
            logger.error(`Unexpected tool batch error: ${message}`);
            return {
                role: 'tool',
                content: `Error: ${message}`,
                tool_call_id: toolCalls[i].id
            };
        });
    }
}