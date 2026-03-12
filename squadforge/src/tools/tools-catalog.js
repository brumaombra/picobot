import { createDelegateToAgentTool } from './predefined/delegate_to_agent.js';
import { createReadFileTool } from './predefined/read_file.js';
import { loadExternalToolsFromDirectory } from '../loaders/load-external-tools.js';
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

// Load one merged tools catalog containing external tools plus predefined tool factories
export const loadTools = async ({ toolsDir } = {}) => {
    // Load external tools
    const externalTools = await loadExternalToolsFromDirectory({ toolsDir });
    const tools = new Map(externalTools);

    // Add the predefined tools to the catalog
    for (const [name, createTool] of Object.entries(PREDEFINED_TOOL_CREATORS)) {
        // Check for name conflicts
        if (tools.has(name)) {
            throw new Error(`Duplicate tool name "${name}" found in the predefined tools catalog.`);
        }

        // Add the predefined tool
        tools.set(name, {
            name,
            createTool
        });
    }

    // Return the merged tools catalog
    return tools;
};

// Resolve a tool from the merged tools catalog for a specific agent context
export const resolveTool = ({ squad, agent, name }) => {
    // Get the tool entry from the squad's tools catalog
    const toolEntry = squad.tools.get(name);
    if (!toolEntry) {
        return null;
    }

    // If the tool entry has a createTool function, call it with the agent context to get the tool definition
    if (typeof toolEntry.createTool === 'function') {
        return toolEntry.createTool({ squad, agent });
    }

    // Otherwise, return the tool entry as the tool definition
    return toolEntry;
};