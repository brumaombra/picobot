import { readFileTool, writeFileTool, listDirTool } from './general/filesystem.js';
import { shellTool } from './general/shell.js';
import { webFetchTool } from './general/web.js';
import { cronTool } from './general/cron.js';
import { subagentTool } from './general/subagent.js';
import { routeToCategoryTool } from './general/route.js';
import { gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool } from './gmail/gmail.js';
import { calendarListEventsTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool } from './calendar/calendar.js';
import { driveListFilesTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool } from './drive/drive.js';

// Tool categories for organized access
export const toolCategories = {
    general: {
        name: 'General',
        description: 'General-purpose tools for common operations and utilities',
        tools: [readFileTool, writeFileTool, listDirTool, shellTool, webFetchTool, cronTool, subagentTool, routeToCategoryTool]
    },
    gmail: {
        name: 'Gmail',
        description: 'Gmail tools for email management',
        tools: [gmailSearchTool, gmailReadTool, gmailSendTool, gmailLabelsTool]
    },
    calendar: {
        name: 'Calendar',
        description: 'Google Calendar tools for event management',
        tools: [calendarListEventsTool, calendarCreateEventTool, calendarUpdateEventTool, calendarDeleteEventTool]
    },
    drive: {
        name: 'Drive',
        description: 'Google Drive tools for file management',
        tools: [driveListFilesTool, driveReadFileTool, driveCreateFileTool, driveUpdateFileTool, driveDeleteFileTool, driveShareFileTool]
    }
};

// Flat list of all tools
const allTools = Object.values(toolCategories).flatMap(category => category.tools);

// Get a tool by name
export const getTool = name => {
    return allTools.find(tool => tool.name === name);
};

// Filter tools based on include/exclude tool names or categories
const filterTools = filter => {
    let toolsToUse;

    // Determine base tool set (include > categories > all)
    if (filter?.include?.length) {
        toolsToUse = filter.include.map(name => getTool(name)).filter(Boolean);
    } else if (filter?.categories?.length) {
        toolsToUse = filter.categories.flatMap(category => toolCategories[category]?.tools || []);
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
    for (const [categoryKey, category] of Object.entries(toolCategories)) {
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