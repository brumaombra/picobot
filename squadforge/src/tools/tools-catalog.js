import { createDelegateToAgentTool } from './predefined/delegate_to_agent.js';
import { createReadFileTool } from './predefined/read_file.js';
import { getAgentRole } from '../utils/utils.js';

// List of predefined tool names available to each agent role
const PREDEFINED_TOOL_NAMES_BY_AGENT_ROLE = {
    leader: ['read_file', 'delegate_to_agent'],
    subagent: []
};

// Full list of predefined tools
const PREDEFINED_TOOL_CREATORS = {
    read_file: ({ squad }) => createReadFileTool({ squad }),
    delegate_to_agent: ({ squad, agent }) => createDelegateToAgentTool({ squad, agent })
};

// Create the predefined tool name list for a specific agent role and app shape
export const createPredefinedToolList = ({ agentId, hasSubagents = false } = {}) => {
    const agentRole = getAgentRole(agentId);
    const toolNames = [...(PREDEFINED_TOOL_NAMES_BY_AGENT_ROLE[agentRole] || [])];

    // If subagents are not present, remove the delegate_to_agent tool
    if (!hasSubagents) {
        return toolNames.filter(toolName => toolName !== 'delegate_to_agent');
    }

    // Return the full list
    return toolNames;
};

// Resolve a tool name to either a predefined tool or an externally loaded tool
const resolveTool = ({ squad, agent, name }) => {
    // Check if the tool name corresponds to a predefined tool and create it if so
    const createTool = PREDEFINED_TOOL_CREATORS[name];
    if (createTool) {
        return createTool({ squad, agent });
    }

    // Otherwise, try to resolve it as an externally loaded tool
    return squad.getTool(name);
};

// List all tools available to a specific agent
export const listAvailableTools = ({ squad, agent }) => {
    return agent.definition.allowedTools
        .map(toolName => resolveTool({ squad, agent, name: toolName }))
        .filter(Boolean);
};

// Get a single available tool by name for a specific agent
export const getAvailableTool = ({ squad, agent, name }) => {
    if (!agent.definition.allowedTools.includes(name)) {
        return null;
    }

    return resolveTool({ squad, agent, name });
};