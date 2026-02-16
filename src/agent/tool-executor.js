import { getTool } from '../tools/tools.js';
import { logger } from '../utils/logger.js';
import { stringifyJson } from '../utils/utils.js';

// Execute a single tool call
export const executeTool = async (toolCall, context, allowedToolNames) => {
    const toolName = toolCall?.function?.name;

    // Enforce allowed tools (prevents executing tools that were not exposed to the model)
    if (allowedToolNames && toolName && !allowedToolNames.has(toolName)) {
        logger.warn(`Disallowed tool call attempted: ${toolName}`);
        return {
            role: 'tool',
            content: `Error: Tool "${toolName}" is not available. Only tools listed in your allowed_tools can be used.`,
            tool_call_id: toolCall?.id
        };
    }

    // Find the tool
    const tool = toolName ? getTool(toolName) : null;
    if (!tool) {
        // Unknown tool — return error message
        logger.warn(`Unknown tool: ${toolName}`);
        return {
            role: 'tool',
            content: `Error: Unknown tool "${toolName}"`,
            tool_call_id: toolCall?.id
        };
    }

    try {
        // Parse arguments
        const rawArgs = toolCall?.function?.arguments;
        let args = {};

        // Check the type of the arguments and parse accordingly
        if (typeof rawArgs === 'string') {
            const trimmed = rawArgs.trim();
            if (trimmed) {
                try {
                    args = JSON.parse(trimmed);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    logger.warn(`Invalid JSON arguments for tool ${toolName}: ${message}`);
                    return {
                        role: 'tool',
                        content: `Error: Invalid JSON arguments for tool "${toolName}": ${message}`,
                        tool_call_id: toolCall?.id
                    };
                }
            }
        } else if (rawArgs && typeof rawArgs === 'object') {
            args = rawArgs;
        }

        // Execute the tool
        logger.debug(`Executing tool: ${toolName}`);
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
        logger.debug(`Tool ${toolName} executed`);

        // Return the tool execution result
        return {
            role: 'tool',
            content,
            tool_call_id: toolCall?.id
        };
    } catch (error) {
        // Log execution error
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Tool execution error: ${message}`);

        // Return error message
        return {
            role: 'tool',
            content: `Error executing tool: ${message}`,
            tool_call_id: toolCall?.id
        };
    }
};

// Execute multiple tool calls in parallel
export const executeToolBatch = async (toolCalls, context, allowedToolNames) => {
    const settled = await Promise.allSettled(
        toolCalls.map(call => executeTool(call, context, allowedToolNames))
    );

    // Map settled results, converting any unexpected rejections to error messages
    return settled.map((result, i) => {
        if (result.status === 'fulfilled') return result.value;
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.error(`Unexpected tool batch error: ${message}`);
        return {
            role: 'tool',
            content: `Error: ${message}`,
            tool_call_id: toolCalls?.[i]?.id
        };
    });
};