import { createDelegateToAgentTool } from './predefined/delegate_to_agent.js';

// List built-in tools available to an agent
export const listPredefinedTools = ({ squad, agent }) => {
    const availableSubagents = squad.listSubagentSpecs();
    if (availableSubagents.length === 0) {
        return [];
    }

    return [
        createDelegateToAgentTool({ squad, agent })
    ];
};

// Get a built-in tool by name for an agent
export const getPredefinedTool = ({ squad, agent, name }) => {
    return listPredefinedTools({ squad, agent }).find(tool => tool.name === name) || null;
};