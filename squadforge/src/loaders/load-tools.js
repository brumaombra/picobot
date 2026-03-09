import { existsSync, readdirSync } from 'fs';
import { extname, join } from 'path';
import { pathToFileURL } from 'url';

const SUPPORTED_EXTENSIONS = new Set(['.js', '.mjs']);

const normalizeTool = (tool, filePath) => {
    if (!tool || typeof tool !== 'object') {
        throw new Error(`Tool module must export an object: ${filePath}`);
    }

    if (!tool.name) {
        throw new Error(`Tool is missing a name: ${filePath}`);
    }

    if (typeof tool.execute !== 'function') {
        throw new Error(`Tool is missing an execute function: ${filePath}`);
    }

    return {
        name: String(tool.name),
        description: String(tool.description || ''),
        parameters: tool.parameters || {
            type: 'object',
            properties: {}
        },
        execute: tool.execute,
        filePath
    };
};

export const loadToolsFromDirectory = async toolsDir => {
    if (!toolsDir) {
        throw new Error('toolsDir is required.');
    }

    if (!existsSync(toolsDir)) {
        return new Map();
    }

    const files = readdirSync(toolsDir)
        .filter(fileName => SUPPORTED_EXTENSIONS.has(extname(fileName).toLowerCase()))
        .sort((left, right) => left.localeCompare(right));

    const tools = new Map();

    for (const fileName of files) {
        const filePath = join(toolsDir, fileName);
        const moduleUrl = pathToFileURL(filePath).href;
        const importedModule = await import(moduleUrl);
        const rawTool = importedModule.default || importedModule.tool || importedModule;
        const tool = normalizeTool(rawTool, filePath);
        tools.set(tool.name, tool);
    }

    return tools;
};