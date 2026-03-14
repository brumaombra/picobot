import { readdirSync } from 'fs';
import { join, relative } from 'path';

const walk = (rootDir, currentDir, results = []) => {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
            walk(rootDir, fullPath, results);
            continue;
        }

        results.push(relative(rootDir, fullPath).replace(/\\/g, '/'));
    }

    return results;
};

export default {
    name: 'list_project_files',
    description: 'Lists all files in the sample project for debugging tasks.',
    parameters: {
        type: 'object',
        properties: {}
    },
    execute: async (_args, context) => {
        const projectDir = join(context.runtime.rootDir, 'project');
        return {
            success: true,
            output: walk(projectDir, projectDir)
        };
    }
};
