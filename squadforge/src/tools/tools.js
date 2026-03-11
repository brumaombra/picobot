import { createDelegateToAgentTool } from './predefined/delegate_to_agent.js';
import { createReadFileTool } from './predefined/read_file.js';

// List built-in tools available to an agent
export const listPredefinedTools = ({ squad, agent }) => {
    const availableSubagents = squad.listSubagentSpecs();

    // Add the default tools
    const tools = [
        createReadFileTool({ squad })
    ];

    // Check if there are any subagents
    if (availableSubagents.length > 0) {
        tools.push(createDelegateToAgentTool({ squad, agent }));
    }

    // Return the list of tools
    return tools;
};

// Get a built-in tool by name for an agent
export const getPredefinedTool = ({ squad, agent, name }) => {
    return listPredefinedTools({ squad, agent }).find(tool => tool.name === name) || null;
};