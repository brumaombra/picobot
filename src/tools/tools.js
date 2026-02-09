import { readFileTool, writeFileTool, listDirTool } from './toolbox/general/filesystem.js';
import { shellTool } from './toolbox/general/shell.js';
import { webFetchTool } from './toolbox/general/web.js';
import { cronTool } from './toolbox/general/cron.js';
import { subagentTool } from './toolbox/general/subagent.js';
import { routeToCategoryTool } from './toolbox/general/route.js';
import { gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool } from './toolbox/gmail/gmail.js';
import { calendarListEventsTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool } from './toolbox/calendar/calendar.js';
import { driveListFilesTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool } from './toolbox/drive/drive.js';

// Tool categories for organized access
export const toolCategories = {
    general: {
        name: 'General',
        description: 'Core tools for filesystem, shell, web access, cron scheduling, subagents, and category routing',
        tools: [readFileTool, writeFileTool, listDirTool, shellTool, webFetchTool, cronTool, subagentTool, routeToCategoryTool]
    },
    gmail: {
        name: 'Gmail',
        description: 'Gmail tools for searching, reading, sending, and managing labels',
        tools: [gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool]
    },
    calendar: {
        name: 'Calendar',
        description: 'Google Calendar tools for listing, creating, updating, and deleting events',
        tools: [calendarListEventsTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool]
    },
    drive: {
        name: 'Drive',
        description: 'Google Drive tools for listing, reading, creating, updating, deleting, and sharing files',
        tools: [driveListFilesTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool]
    }
};

// Flat list of all tools
const allTools = Object.values(toolCategories).flatMap(category => category.tools);

// Get routable categories (all except 'general')
export const getRoutableCategories = () => {
    return Object.keys(toolCategories).filter(key => key !== 'general');
};

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
        toolsToUse = filter.categories.flatMap(category => toolCategories[category]?.tools || []);
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

// Generate a formatted text list of all tools grouped by category for documentation
export const generateToolsList = () => {
    const sections = [];

    // Iterate over categories and their tools to build the list
    for (const [categoryKey, category] of Object.entries(toolCategories)) {
        const lines = [];

        // Category header with name and key
        lines.push(`### ${category.name} (${categoryKey})`);
        lines.push('');
        lines.push(category.description);
        lines.push('');

        // Tool list - just name and description
        for (const tool of category.tools) {
            lines.push(`- \`${tool.name}\`: ${tool.description}`);
        }

        // Add spacing after each category
        lines.push('');
        sections.push(lines.join('\n'));
    }

    // Combine all sections into the final output
    return sections.join('\n\n');
};