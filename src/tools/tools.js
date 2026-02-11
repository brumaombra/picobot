import { TOOLS_LIST } from '../config.js';
import { shellTool } from './general/shell.js';
import { subagentTool } from './general/subagent.js';
import { getDateTimeTool } from './general/datetime.js';
import { systemInfoBasicTool, systemInfoCpuTool, systemInfoMemoryTool, systemInfoNetworkTool, systemInfoAllTool } from './system/system.js';
import { routeToCategoryTool } from './general/route.js';
import { webFetchTool } from './web/fetch.js';
import { webSearchTool } from './web/search.js';
import { readFileTool, writeFileTool, listDirTool, deleteTool, renameFileTool, copyFileTool, pathExistsTool, fileSearchTool } from './filesystem/filesystem.js';
import { cronCreateTool, cronListTool, cronGetTool, cronUpdateTool, cronDeleteTool } from './cron/cron.js';
import { gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool } from './gmail/gmail.js';
import { calendarListEventsTool, calendarGetEventTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool } from './calendar/calendar.js';
import { driveListFilesTool, driveGetFileTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool } from './drive/drive.js';

let allTools = [];
let toolMap = new Map();

// Initialize tool categories with actual tools
export const initTools = () => {
    // Fill the TOOLS_LIST with actual tool definitions
    TOOLS_LIST.general.tools = [shellTool, getDateTimeTool, subagentTool, routeToCategoryTool];
    TOOLS_LIST.system.tools = [systemInfoBasicTool, systemInfoCpuTool, systemInfoMemoryTool, systemInfoNetworkTool, systemInfoAllTool];
    TOOLS_LIST.web.tools = [webFetchTool, webSearchTool];
    TOOLS_LIST.filesystem.tools = [readFileTool, writeFileTool, listDirTool, deleteTool, renameFileTool, copyFileTool, pathExistsTool, fileSearchTool];
    TOOLS_LIST.cron.tools = [cronCreateTool, cronListTool, cronGetTool, cronUpdateTool, cronDeleteTool];
    TOOLS_LIST.gmail.tools = [gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool];
    TOOLS_LIST.calendar.tools = [calendarListEventsTool, calendarGetEventTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool];
    TOOLS_LIST.drive.tools = [driveListFilesTool, driveGetFileTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool];

    // Create a flat list and lookup map for easy access
    allTools = Object.values(TOOLS_LIST).flatMap(category => category.tools);
    toolMap = new Map(allTools.map(tool => [tool.name, tool]));
};

// Get a tool by name
export const getTool = name => {
    return toolMap.get(name);
};

// Filter tools based on include/exclude tool names or categories
const filterTools = filter => {
    let toolsToUse;

    // Determine base tool set (include > categories > all)
    if (filter?.include?.length) {
        toolsToUse = filter.include.map(name => getTool(name)).filter(Boolean);
    } else if (filter?.categories?.length) {
        toolsToUse = filter.categories.flatMap(category => TOOLS_LIST[category]?.tools || []);
    } else {
        toolsToUse = allTools;
    }

    // Remove excluded tools
    if (filter?.exclude?.length) {
        const excludedSet = new Set(filter.exclude);
        toolsToUse = toolsToUse.filter(tool => !excludedSet.has(tool.name));
    }

    // Return the final filtered list of tools
    return toolsToUse;
};

// Get tool definitions for the LLM, optionally filtered by include/exclude tool names or categories
export const getToolsDefinitions = filter => {
    // Filter tools based on provided criteria
    const toolsToUse = filterTools(filter);

    // Return tool definitions in the format expected by the LLM
    return toolsToUse.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
};

// Generate a formatted text list of all tools grouped by category for documentation
export const generateToolsList = filter => {
    // Filter tools based on provided criteria
    const toolsToUse = filterTools(filter);
    const sections = [];

    // Iterate over categories and their tools to build the list
    for (const [categoryKey, category] of Object.entries(TOOLS_LIST)) {
        // Filter tools that belong to this category
        const categoryTools = category.tools.filter(tool => toolsToUse.includes(tool));
        if (categoryTools.length === 0) {
            continue; // Skip categories with no tools after filtering
        }

        const lines = [];

        // Category header with name and key
        lines.push(`### ${category.name} (${categoryKey})`);
        lines.push('');
        lines.push(category.description);
        lines.push('');

        // Tool list - just name and description
        for (const tool of categoryTools) {
            lines.push(`- \`${tool.name}\`: ${tool.description}`);
        }

        // Add spacing after each category
        lines.push('');
        sections.push(lines.join('\n'));
    }

    // Combine all sections into the final output
    return sections.join('\n\n');
};