import { askMainAgentTool } from './predefined/general/ask_main_agent.js';
import { cronCreateTool } from './predefined/cron/cron_create.js';
import { cronDeleteTool } from './predefined/cron/cron_delete.js';
import { cronGetTool } from './predefined/cron/cron_get.js';
import { cronListTool } from './predefined/cron/cron_list.js';
import { cronUpdateTool } from './predefined/cron/cron_update.js';
import { readFileTool } from './predefined/general/read_file.js';
import { sendFileTool } from './predefined/general/send_file.js';
import { subagentChatTool } from './predefined/general/subagent_chat.js';
import { subagentListTool } from './predefined/general/subagent_list.js';
import { subagentStartTool } from './predefined/general/subagent_start.js';
import { loadExternalToolsFromDirectory } from '../loaders/load-external-tools.js';
import { getAgentRole } from '../utils/utils.js';

const OPTIONAL_BUILTIN_TOOLS = [cronCreateTool, cronDeleteTool, cronGetTool, cronListTool, cronUpdateTool];

// Predefined tools grouped by agent role
const PREDEFINED_TOOLS_BY_ROLE = {
    leader: [readFileTool, sendFileTool, subagentStartTool, subagentChatTool, subagentListTool],
    subagent: [askMainAgentTool]
};

// Create the predefined tool name list for a specific agent role and app shape
export const createPredefinedToolList = ({ agentId, hasSubagents = false } = {}) => {
    const agentRole = getAgentRole(agentId);
    let predefinedTools = [...(PREDEFINED_TOOLS_BY_ROLE[agentRole] || [])];

    // Remove the tools that need subagents
    if (!hasSubagents) {
        predefinedTools = predefinedTools.filter(tool => !['subagent_start', 'subagent_chat', 'subagent_list'].includes(tool.name));
    }

    // Return the list of predefined tool names for the agent
    return predefinedTools.map(tool => tool.name);
};

// Load one merged tools catalog containing external tools plus predefined tools
export const loadTools = async ({ toolsDir } = {}) => {
    // Load external tools
    const externalTools = await loadExternalToolsFromDirectory({ toolsDir });
    const tools = new Map(externalTools);
    const predefinedTools = [...new Map([...Object.values(PREDEFINED_TOOLS_BY_ROLE).flat(), ...OPTIONAL_BUILTIN_TOOLS].map(tool => [tool.name, tool])).values()];

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