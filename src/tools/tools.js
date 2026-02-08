import { readFileTool, writeFileTool, listDirTool } from './toolbox/filesystem.js';
import { shellTool } from './toolbox/shell.js';
import { webFetchTool } from './toolbox/web.js';
import { messageTool } from './toolbox/message.js';
import { subagentTool } from './toolbox/subagent.js';
import { gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool } from './toolbox/gmail.js';
import { calendarListEventsTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool } from './toolbox/calendar.js';
import { driveListFilesTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool } from './toolbox/drive.js';

// Tool registry
const tools = new Map([
    // General tools
    [readFileTool.name, readFileTool],
    [writeFileTool.name, writeFileTool],
    [listDirTool.name, listDirTool],
    [shellTool.name, shellTool],
    [webFetchTool.name, webFetchTool],
    [messageTool.name, messageTool],
    [subagentTool.name, subagentTool],

    // Gmail tools
    [gmailSearchTool.name, gmailSearchTool],
    [gmailReadTool.name, gmailReadTool],
    [gmailSendTool.name, gmailSendTool],
    [gmailLabelsTool.name, gmailLabelsTool],

    // Calendar tools
    [calendarListEventsTool.name, calendarListEventsTool],
    [calendarCreateEventTool.name, calendarCreateEventTool],
    [calendarUpdateEventTool.name, calendarUpdateEventTool],
    [calendarDeleteEventTool.name, calendarDeleteEventTool],

    // Drive tools
    [driveListFilesTool.name, driveListFilesTool],
    [driveReadFileTool.name, driveReadFileTool],
    [driveCreateFileTool.name, driveCreateFileTool],
    [driveUpdateFileTool.name, driveUpdateFileTool],
    [driveDeleteFileTool.name, driveDeleteFileTool],
    [driveShareFileTool.name, driveShareFileTool]
]);

// Get a tool by name
export const getTool = name => {
    return tools.get(name);
};

// Check if a tool exists
export const hasTool = name => {
    return tools.has(name);
};

// Get tool definitions for the LLM, optionally filtered by allowed/denied tool names
export const getToolsDefinitions = filter => {
    let toolsToUse = Array.from(tools.values());

    // Apply filter if provided
    if (filter) {
        // If allowed list is specified, only include those tools
        if (filter.allowed && Array.isArray(filter.allowed)) {
            toolsToUse = filter.allowed.map(name => tools.get(name)).filter(Boolean);
        }

        // If denied list is specified, exclude those tools
        if (filter.denied && Array.isArray(filter.denied)) {
            toolsToUse = toolsToUse.filter(tool => !filter.denied.includes(tool.name));
        }
    }

    // Convert to LLM tool definition format
    return toolsToUse.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
};