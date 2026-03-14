import { parseJson, stringifyJson } from '../utils/utils.js';
import { emitRuntimeOutboundMessage } from '../runtime/channel.js';
import { emitRuntimeEvent } from '../runtime/events.js';
import { findAgentById, findAgentBySessionId, getLeaderAgent } from '../runtime/lookup.js';

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
const executeToolCall = async ({ agent, toolCall }) => {
    const toolName = toolCall?.function?.name;
    const toolCallId = toolCall?.id;

    try {
        // Get the agent tool by name
        const tool = agent.getTool(toolName);
        if (!tool) {
            throw new Error(`Unknown or disallowed tool "${toolName}".`);
        }

        // Emit a tool start event
        emitRuntimeEvent(agent.runtime, 'toolStart', {
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId
        });

        // Parse the tool call arguments and execute the tool function
        const args = parseJson(toolCall?.function?.arguments);
        const result = await tool.execute(args, {
            runtime: agent.runtime,
            agent,
            parentAgent: agent.parent,
            leaderAgent: getLeaderAgent(agent.runtime, agent.sessionId),
            sessionId: agent.sessionId,
            sessionKey: agent.sessionId,
            workingDir: agent.runtime.workspaceDir || agent.runtime.rootDir || process.cwd(),
            subagentId: agent.parent ? agent.id : null,
            launchSubagent: (type, prompt) => agent.launchSubagent(type, prompt),
            chatSubagent: (subagentId, message) => agent.chatSubagent(subagentId, message),
            listActiveSubagents: () => agent.listActiveSubagents(),
            askMainAgent: question => agent.askMainAgent(question),
            emitOutboundMessage: message => emitRuntimeOutboundMessage(agent.runtime, message),
            findAgentById: agentId => findAgentById(agent.runtime, agentId),
            findAgentBySessionId: sessionId => findAgentBySessionId(agent.runtime, sessionId)
        });

        // Emit a tool finish event
        emitRuntimeEvent(agent.runtime, 'toolFinish', {
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
        emitRuntimeEvent(agent.runtime, 'toolError', {
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
    const toolCallPromises = toolCalls.map(toolCall => executeToolCall({ agent, toolCall }));
    return Promise.all(toolCallPromises);
};