import { shellTool } from './general/shell.js';
import { subagentTool } from './general/subagent.js';
import { getDateTimeTool } from './general/datetime.js';
import { sendFileTool } from './general/send-file.js';
import { systemInfoBasicTool, systemInfoCpuTool, systemInfoMemoryTool, systemInfoNetworkTool, systemInfoAllTool } from './system/system.js';
import { webFetchTool } from './web/fetch.js';
import { webSearchTool } from './web/search.js';
import { readFileTool, writeFileTool, listDirTool, deleteTool, renameFileTool, copyFileTool, pathExistsTool, fileSearchTool } from './filesystem/filesystem.js';
import { cronCreateTool, cronListTool, cronGetTool, cronUpdateTool, cronDeleteTool } from './cron/cron.js';
import { gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool } from './gmail/gmail.js';
import { calendarListEventsTool, calendarGetEventTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool } from './calendar/calendar.js';
import { driveListFilesTool, driveGetFileTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool } from './drive/drive.js';
import { browserTool } from './browser/browser.js';

// Registry of all available tools (flat map: name → tool)
const TOOLS = new Map([
    // General tools
    [shellTool.name, shellTool],
    [getDateTimeTool.name, getDateTimeTool],
    [subagentTool.name, subagentTool],
    [sendFileTool.name, sendFileTool],

    // System tools
    [systemInfoBasicTool.name, systemInfoBasicTool],
    [systemInfoCpuTool.name, systemInfoCpuTool],
    [systemInfoMemoryTool.name, systemInfoMemoryTool],
    [systemInfoNetworkTool.name, systemInfoNetworkTool],
    [systemInfoAllTool.name, systemInfoAllTool],

    // Web tools
    [webFetchTool.name, webFetchTool],
    [webSearchTool.name, webSearchTool],

    // Filesystem tools
    [readFileTool.name, readFileTool],
    [writeFileTool.name, writeFileTool],
    [listDirTool.name, listDirTool],
    [deleteTool.name, deleteTool],
    [renameFileTool.name, renameFileTool],
    [copyFileTool.name, copyFileTool],
    [pathExistsTool.name, pathExistsTool],
    [fileSearchTool.name, fileSearchTool],

    // Cron tools
    [cronCreateTool.name, cronCreateTool],
    [cronListTool.name, cronListTool],
    [cronGetTool.name, cronGetTool],
    [cronUpdateTool.name, cronUpdateTool],
    [cronDeleteTool.name, cronDeleteTool],

    // Gmail tools
    [gmailSearchTool.name, gmailSearchTool],
    [gmailReadTool.name, gmailReadTool],
    [gmailSendTool.name, gmailSendTool],
    [gmailLabelsTool.name, gmailLabelsTool],

    // Calendar tools
    [calendarListEventsTool.name, calendarListEventsTool],
    [calendarGetEventTool.name, calendarGetEventTool],
    [calendarCreateEventTool.name, calendarCreateEventTool],
    [calendarUpdateEventTool.name, calendarUpdateEventTool],
    [calendarDeleteEventTool.name, calendarDeleteEventTool],

    // Drive tools
    [driveListFilesTool.name, driveListFilesTool],
    [driveGetFileTool.name, driveGetFileTool],
    [driveReadFileTool.name, driveReadFileTool],
    [driveCreateFileTool.name, driveCreateFileTool],
    [driveUpdateFileTool.name, driveUpdateFileTool],
    [driveDeleteFileTool.name, driveDeleteFileTool],
    [driveShareFileTool.name, driveShareFileTool],

    // Browser tools
    [browserTool.name, browserTool]
]);

// Get a tool by name
export const getTool = name => {
    return TOOLS.get(name);
};

// Resolve a list of tool names to tool objects, filtering out unknown names
const resolveTools = toolNames => {
    // If specific tool names are provided, return those tools (filtering out any unknown names)
    if (toolNames?.length) {
        return toolNames.map(name => TOOLS.get(name)).filter(Boolean);
    }

    // If no specific tool names provided, return all available tools
    return [...TOOLS.values()];
};

// Get tool definitions for the LLM, filtered by allowed tool names
export const getToolsDefinitions = toolNames => {
    const tools = resolveTools(toolNames);

    // Return tool definitions in the format expected by the LLM
    return tools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
};

// Generate a formatted text list of tools for documentation/prompts
export const generateToolsList = toolNames => {
    const tools = resolveTools(toolNames);
    return tools.map(tool => `- \`${tool.name}\`: ${tool.description}`).join('\n');
};