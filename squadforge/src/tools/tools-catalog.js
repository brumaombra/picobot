import { delegateToAgentTool } from './predefined/delegate_to_agent.js';
import { readFileTool } from './predefined/read_file.js';
import { loadExternalToolsFromDirectory } from '../loaders/load-external-tools.js';
import { getAgentRole } from '../utils/utils.js';

// Predefined tools grouped by agent role
const PREDEFINED_TOOLS_BY_ROLE = {
    leader: [readFileTool, delegateToAgentTool],
    subagent: []
};

// Create the predefined tool name list for a specific agent role and app shape
export const createPredefinedToolList = ({ agentId, hasSubagents = false } = {}) => {
    const agentRole = getAgentRole(agentId);
    let predefinedTools = [...(PREDEFINED_TOOLS_BY_ROLE[agentRole] || [])];

    // Remove the tools that need subagents
    if (!hasSubagents) {
        predefinedTools = predefinedTools.filter(tool => tool.name !== 'delegate_to_agent');
    }

    // Return the list of predefined tool names for the agent
    return predefinedTools.map(tool => tool.name);
};

// Load one merged tools catalog containing external tools plus predefined tools
export const loadTools = async ({ toolsDir } = {}) => {
    // Load external tools
    const externalTools = await loadExternalToolsFromDirectory({ toolsDir });
    const tools = new Map(externalTools);
    const predefinedTools = Object.values(PREDEFINED_TOOLS_BY_ROLE).flat();

    // Add the predefined tools to the catalog
    for (const tool of predefinedTools) {
        // Check for name conflicts
        if (tools.has(tool.name)) {
            throw new Error(`Duplicate tool name "${tool.name}" found in the predefined tools catalog.`);
        }

        // Add the predefined tool
        tools.set(tool.name, tool);
    }

    // Return the merged tools catalog
    return tools;
};