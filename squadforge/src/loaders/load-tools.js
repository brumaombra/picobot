import { existsSync, readdirSync } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';
import { SUPPORTED_TOOL_EXTENSIONS } from '../config.js';

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

    // Find all supported tool files in the tools directory
    const files = readdirSync(toolsDir).filter(fileName => SUPPORTED_TOOL_EXTENSIONS.includes(extname(fileName).toLowerCase()));

    // Load each tool and store it in a map by name
    const tools = new Map();
    for (const fileName of files) {
        const filePath = join(toolsDir, fileName);
        const moduleUrl = pathToFileURL(filePath).href;
        const importedModule = await import(moduleUrl);
        const rawTool = importedModule.default || importedModule.tool || importedModule;
        const tool = normalizeTool({ rawTool, filePath });
        tools.set(tool.name, tool);
    }

    // Return the map of tools
    return tools;
};