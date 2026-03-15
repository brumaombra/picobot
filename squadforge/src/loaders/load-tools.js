import { existsSync, readdirSync } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';
import { SUPPORTED_TOOL_EXTENSIONS } from '../config.js';
import { askMainAgentTool } from '../tools/predefined/agent/ask_main_agent.js';
import { cronCreateTool } from '../tools/predefined/cron/cron_create.js';
import { cronDeleteTool } from '../tools/predefined/cron/cron_delete.js';
import { cronGetTool } from '../tools/predefined/cron/cron_get.js';
import { cronListTool } from '../tools/predefined/cron/cron_list.js';
import { cronUpdateTool } from '../tools/predefined/cron/cron_update.js';
import { getDatetimeTool } from '../tools/predefined/general/get_datetime.js';
import { readFileTool } from '../tools/predefined/general/read_file.js';
import { sendFileTool } from '../tools/predefined/general/send_file.js';
import { subagentChatTool } from '../tools/predefined/agent/subagent_chat.js';
import { subagentListTool } from '../tools/predefined/agent/subagent_list.js';
import { subagentStartTool } from '../tools/predefined/agent/subagent_start.js';
import { getAgentRole } from '../utils/utils.js';

// Built-in tools grouped by purpose
const BUILTIN_TOOLS = {
    leader: [getDatetimeTool, readFileTool, sendFileTool, subagentStartTool, subagentChatTool, subagentListTool],
    subagent: [getDatetimeTool, askMainAgentTool],
    available: [cronCreateTool, cronDeleteTool, cronGetTool, cronListTool, cronUpdateTool]
};

// Create the predefined tool name list for a specific agent role
export const createPredefinedToolList = ({ agentId } = {}) => {
    const agentRole = getAgentRole(agentId);
    const predefinedTools = [...(BUILTIN_TOOLS[agentRole] || [])];
    return predefinedTools.map(tool => tool.name);
};

// Recursively collect all supported tool files from the tools directory
const collectToolFilePaths = directoryPath => {
    // Read the list of entries in the directory and sort them by name for consistent loading order
    const entries = readdirSync(directoryPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

    // Collect file paths and search recursively in subdirectories
    const filePaths = [];
    for (const entry of entries) {
        const fullPath = join(directoryPath, entry.name);

        // If directory, search recursively for tool files
        if (entry.isDirectory()) {
            filePaths.push(...collectToolFilePaths(fullPath));
            continue;
        }

        // If it's a supported tool file, include it
        if (SUPPORTED_TOOL_EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
            filePaths.push(fullPath);
        }
    }

    // Return the list of paths
    return filePaths;
};

// Normalize a loaded tool module into the expected tool shape
const normalizeTool = ({ rawTool, filePath = null, source = null }) => {
    const sourceLabel = filePath || source || (rawTool?.name ? `tool:${rawTool.name}` : 'unknown tool source');

    // Validate the tool shape
    if (!rawTool || typeof rawTool !== 'object') {
        throw new Error(`Tool module must export an object: ${sourceLabel}`);
    }

    // Validate required properties
    if (!rawTool.name) {
        throw new Error(`Tool is missing a name: ${sourceLabel}`);
    }

    // Validate the execute function
    if (typeof rawTool.execute !== 'function') {
        throw new Error(`Tool is missing an execute function: ${sourceLabel}`);
    }

    // Return the normalized tool object
    return {
        name: rawTool.name,
        description: rawTool.description || '',
        parameters: rawTool.parameters || {
            type: 'object',
            properties: {}
        },
        execute: rawTool.execute,
        filePath
    };
};

// Add one validated tool to the catalog and reject duplicate names
const addToolToMap = ({ tools, tool, duplicateMessage }) => {
    // Check for duplicate tool names
    if (tools.has(tool.name)) {
        throw new Error(duplicateMessage(tool));
    }

    // Store the validated tool in the map
    tools.set(tool.name, tool);
};

// Collect the unique built-in tools that should exist in the runtime catalog
const collectBuiltinTools = () => {
    const builtinToolGroups = [BUILTIN_TOOLS.leader, BUILTIN_TOOLS.subagent, BUILTIN_TOOLS.available];
    const toolsByName = new Map();

    // Normalize each built-in tool and keep only one entry per tool name
    for (const toolGroup of builtinToolGroups) {
        for (const rawTool of toolGroup) {
            const tool = normalizeTool({ rawTool, source: `builtin:${rawTool?.name || 'unknown'}` });
            toolsByName.set(tool.name, tool);
        }
    }

    // Return the unique built-in tools
    return [...toolsByName.values()];
};

// Load external tools from the specified directory
const loadExternalTools = async ({ toolsDir } = {}) => {
    // Validate the tools directory
    if (!toolsDir) {
        throw new Error('toolsDir is required.');
    }

    // Return an empty map if the tools directory does not exist
    if (!existsSync(toolsDir)) {
        return new Map();
    }

    // Find all supported tool files in the tools directory tree
    const filePaths = collectToolFilePaths(toolsDir);

    // Load each tool and store it in a map by name
    const tools = new Map();
    for (const filePath of filePaths) {
        // Load and validate the external tool module
        const moduleUrl = pathToFileURL(filePath).href;
        const importedModule = await import(moduleUrl);
        const rawTool = importedModule?.default;
        const tool = normalizeTool({ rawTool, filePath });

        // Store the validated tool in the map
        addToolToMap({
            tools,
            tool,
            duplicateMessage: duplicateTool => `Duplicate tool name "${duplicateTool.name}" found while loading ${filePath}.`
        });
    }

    // Return the map of tools
    return tools;
};

// Load internal built-in tools into one map
const loadInternalTools = () => {
    const builtinTools = collectBuiltinTools();
    const tools = new Map();

    // Add the built-in tools to the catalog
    for (const tool of builtinTools) {
        // Add the validated built-in tool
        addToolToMap({
            tools,
            tool,
            duplicateMessage: duplicateTool => `Duplicate tool name "${duplicateTool.name}" found in the built-in tools catalog.`
        });
    }

    // Return the built-in tools map
    return tools;
};

// Load one merged tools catalog containing external tools plus built-in tools
export const loadTools = async ({ toolsDir } = {}) => {
    // Load internal and external tools before merging them
    const internalTools = loadInternalTools();
    const externalTools = await loadExternalTools({ toolsDir });
    const tools = new Map(internalTools);

    // Add the external tools to the catalog after the internal ones
    for (const tool of externalTools.values()) {
        // Reject any external tool that conflicts with an internal tool name
        addToolToMap({
            tools,
            tool,
            duplicateMessage: duplicateTool => `External tool name "${duplicateTool.name}" conflicts with a built-in tool.`
        });
    }

    // Return the merged tools catalog
    return tools;
};