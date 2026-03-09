const stringify = value => {
    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const parseArguments = rawArguments => {
    if (!rawArguments) {
        return {};
    }

    if (typeof rawArguments === 'string') {
        const trimmed = rawArguments.trim();
        if (!trimmed) {
            return {};
        }

        return JSON.parse(trimmed);
    }

    if (typeof rawArguments === 'object') {
        return rawArguments;
    }

    return {};
};

const normalizeToolOutput = result => {
    if (result && typeof result === 'object' && ('success' in result || 'output' in result || 'error' in result)) {
        if (result.success === false) {
            return `Error: ${result.error || 'Unknown error'}`;
        }

        return stringify(result.output);
    }

    return stringify(result);
};

export const executeToolCall = async ({ agent, toolCall }) => {
    const toolName = toolCall?.function?.name;
    const toolCallId = toolCall?.id;
    const tool = agent.getTool(toolName);

    if (!tool) {
        agent.squad.emitEvent({
            type: 'tool:error',
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId,
            error: `Unknown or disallowed tool "${toolName}".`
        });

        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: `Error: Unknown or disallowed tool "${toolName}".`
        };
    }

    try {
        agent.squad.emitEvent({
            type: 'tool:start',
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId
        });

        const args = parseArguments(toolCall?.function?.arguments);
        const result = await tool.execute(args, {
            squad: agent.squad,
            agent,
            parentAgent: agent.parent,
            leaderAgent: agent.squad.getLeaderAgent(),
            sessionId: agent.sessionId,
            spawnSubagent: (type, options = {}) => agent.spawnSubagent(type, options),
            findAgentById: agentId => agent.squad.findAgentById(agentId),
            findAgentBySessionId: sessionId => agent.squad.findAgentBySessionId(sessionId)
        });

        agent.squad.emitEvent({
            type: 'tool:finish',
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId
        });

        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: normalizeToolOutput(result)
        };
    } catch (error) {
        agent.squad.emitEvent({
            type: 'tool:error',
            agentId: agent.id,
            agentType: agent.definition.id,
            toolName,
            toolCallId,
            error: error instanceof Error ? error.message : String(error)
        });

        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
        };
    }
};

export const executeToolBatch = async ({ agent, toolCalls }) => {
    const settled = await Promise.allSettled(
        toolCalls.map(toolCall => executeToolCall({ agent, toolCall }))
    );

    return settled.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }

        return {
            role: 'tool',
            tool_call_id: toolCalls[index]?.id,
            content: `Error executing tool: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        };
    });
};