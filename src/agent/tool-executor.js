import { getTool } from '../tools/tools.js';
import { logger } from '../utils/logger.js';
import { stringifyJson } from '../utils/utils.js';

// Helper to build a tool message
const toolMsg = (toolCallId, content) => {
    return {
        role: 'tool',
        content,
        tool_call_id: toolCallId
    };
};

// Execute a single tool call
export const executeTool = async (toolCall, context, allowedToolNames) => {
    const toolName = toolCall?.function?.name;
    const id = toolCall?.id;

    // Enforce allowed tools (prevents executing tools that were not exposed to the model)
    if (allowedToolNames && toolName && !allowedToolNames.has(toolName)) {
        logger.warn(`Disallowed tool call attempted: ${toolName}`);
        return toolMsg(id, `Error: Tool "${toolName}" is not available. Only tools listed in your allowed_tools can be used.`);
    }

    // Find the tool
    const tool = toolName ? getTool(toolName) : null;
    if (!tool) {
        logger.warn(`Unknown tool: ${toolName}`);
        return toolMsg(id, `Error: Unknown tool "${toolName}"`);
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
                    return toolMsg(id, `Error: Invalid JSON arguments for tool "${toolName}": ${message}`);
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
        return toolMsg(id, content);
    } catch (error) {
        // Log execution error
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Tool execution error: ${message}`);

        // Return error message
        return toolMsg(id, `Error executing tool: ${message}`);
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
        return toolMsg(toolCalls?.[i]?.id, `Error: ${message}`);
    });
};