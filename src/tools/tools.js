import { readFileTool, writeFileTool, listDirTool } from './toolbox/filesystem.js';
import { shellTool } from './toolbox/shell.js';
import { webFetchTool } from './toolbox/web.js';
import { messageTool } from './toolbox/message.js';
import { subagentTool } from './toolbox/subagent.js';
import { gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool } from './toolbox/gmail.js';
import { calendarListEventsTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool } from './toolbox/calendar.js';
import { driveListFilesTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool } from './toolbox/drive.js';

// Tool categories for organized access
const toolCategories = {
    general: [readFileTool, writeFileTool, listDirTool, shellTool, webFetchTool, messageTool, subagentTool],
    gmail: [gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool],
    calendar: [calendarListEventsTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool],
    drive: [driveListFilesTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool]
};

// Flat list of all tools
const allTools = Object.values(toolCategories).flat();

// Get a tool by name
export const getTool = name => {
    return allTools.find(tool => tool.name === name);
};

// Get tool definitions for the LLM, optionally filtered by allowed/denied tool names or categories
export const getToolsDefinitions = filter => {
    let toolsToUse;

    // Determine base tool set (allowed > categories > all)
    if (filter?.allowed?.length) {
        toolsToUse = filter.allowed.map(name => getTool(name)).filter(Boolean);
    } else if (filter?.categories?.length) {
        toolsToUse = filter.categories.flatMap(cat => toolCategories[cat] || []);
    } else {
        toolsToUse = allTools;
    }

    // Remove denied tools
    if (filter?.denied?.length) {
        const deniedSet = new Set(filter.denied);
        toolsToUse = toolsToUse.filter(tool => !deniedSet.has(tool.name));
    }

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