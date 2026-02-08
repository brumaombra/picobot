import { getTool } from '../tools/tools.js';
import { logger } from '../utils/logger.js';

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
            const args = this.parseArguments(toolCall.function.arguments);

            // Execute the tool
            logger.debug(`Executing tool: ${toolCall.function.name}`);
            const result = await tool.execute(args, context);

            // Create tool message with result
            const content = result.success ? result.output : `Error: ${result.error || 'Unknown error'}`;

            // Log tool result
            logger.debug(`Tool ${toolCall.function.name} executed`);

            // Return tool message
            return {
                role: 'tool',
                content,
                tool_call_id: toolCall.id
            };
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

    // Execute multiple tool calls
    async executeBatch(toolCalls, context) {
        // Execute all tools sequentially
        const results = [];
        for (const call of toolCalls) {
            const result = await this.execute(call, context);
            results.push(result);
        }

        // Return all results
        return results;
    }

    // Parse tool arguments from JSON string
    parseArguments(argsString) {
        try {
            return JSON.parse(argsString);
        } catch {
            return {};
        }
    }
}