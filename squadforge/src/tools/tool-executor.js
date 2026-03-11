import { parseJson, stringifyJson } from '../utils/utils.js';

// Normalize the output of a tool execution into a string format
const normalizeToolOutput = result => {
    // If the result is an object with success, output, or error properties, handle it accordingly
    if (result && typeof result === 'object' && ('success' in result || 'output' in result || 'error' in result)) {
        // If the tool execution was not successful, return the error message
        if (result.success === false) {
            return `Error: ${result.error || 'Unknown error'}`;
        }

        // If the tool execution was successful, return the output
        return stringifyJson(result.output);
    }

    // For any other type of result, return it as a string
    return stringifyJson(result);
};

// Execute a single tool call
export const executeToolCall = async ({ agent, toolCall }) => {
    const toolName = toolCall?.function?.name;
    const toolCallId = toolCall?.id;
    const tool = agent.getTool(toolName);

    // If the tool is not found or not allowed, return an error message
    if (!tool) {
        // Emit a tool error event
        agent.squad.emitEvent('toolError', {
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId,
            error: `Unknown or disallowed tool "${toolName}".`
        });

        // Return an error message as the tool output
        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: `Error: Unknown or disallowed tool "${toolName}".`
        };
    }

    // Emit a tool start event
    agent.squad.emitEvent('toolStart', {
        agentId: agent.id,
        agentType: agent.definition.id,
        toolName,
        toolCallId
    });

    try {
        // Parse the tool call arguments and execute the tool function
        const args = parseJson(toolCall?.function?.arguments);
        const result = await tool.execute(args, {
            squad: agent.squad,
            agent,
            parentAgent: agent.parent,
            leaderAgent: agent.squad.getLeaderAgent(agent.sessionId),
            sessionId: agent.sessionId,
            spawnSubagent: (type, options = {}) => agent.spawnSubagent(type, options),
            findAgentById: agentId => agent.squad.findAgentById(agentId),
            findAgentBySessionId: sessionId => agent.squad.findAgentBySessionId(sessionId)
        });

        // Emit a tool finish event
        agent.squad.emitEvent('toolFinish', {
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId
        });

        // Return the normalized tool output
        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: normalizeToolOutput(result)
        };
    } catch (error) {
        // Emit a tool error event
        agent.squad.emitEvent('toolError', {
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId,
            error: error instanceof Error ? error.message : error
        });

        // Return an error message as the tool output
        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: `Error executing tool: ${error instanceof Error ? error.message : error}`
        };
    }
};

// Execute a batch of tool calls
export const executeToolBatch = async ({ agent, toolCalls }) => {
    // Execute all tool calls in parallel
    const toolCallsPromises = toolCalls.map(toolCall => executeToolCall({ agent, toolCall }));
    const settled = await Promise.allSettled(toolCallsPromises);

    // Return the results
    return settled.map((result, index) => {
        // If success, return the tool output
        if (result.status === 'fulfilled') {
            return result.value;
        }

        // If rejected, return the error message
        return {
            role: 'tool',
            tool_call_id: toolCalls[index]?.id,
            content: `Error executing tool: ${result.reason instanceof Error ? result.reason.message : result.reason}`
        };
    });
};