import { existsSync, readdirSync } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';
import { SUPPORTED_TOOL_EXTENSIONS } from '../config.js';

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

        // If it's a JS/TS file, include it
        if (SUPPORTED_TOOL_EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
            filePaths.push(fullPath);
        }
    }

    // Return the list of paths
    return filePaths;
};

// Normalize a loaded tool module into the expected tool shape
const normalizeTool = ({ rawTool, filePath }) => {
    // Validate the tool shape
    if (!rawTool || typeof rawTool !== 'object') {
        throw new Error(`Tool module must export an object: ${filePath}`);
    }

    // Validate required properties
    if (!rawTool.name) {
        throw new Error(`Tool is missing a name: ${filePath}`);
    }

    // Validate the execute function
    if (typeof rawTool.execute !== 'function') {
        throw new Error(`Tool is missing an execute function: ${filePath}`);
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

// Load tools from the specified directory
export const loadToolsFromDirectory = async ({ toolsDir } = {}) => {
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
        // Dynamically import the tool module
        const moduleUrl = pathToFileURL(filePath).href;
        const importedModule = await import(moduleUrl);
        const rawTool = importedModule.default || importedModule.tool || importedModule;
        const tool = normalizeTool({ rawTool, filePath });

        // Check for duplicate tool names
        if (tools.has(tool.name)) {
            throw new Error(`Duplicate tool name "${tool.name}" found while loading ${filePath}.`);
        }

        // Store the tool in the map
        tools.set(tool.name, tool);
    }

    // Return the map of tools
    return tools;
};