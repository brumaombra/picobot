import { readdirSync } from 'fs';
import { join, relative } from 'path';

// Recursively collect file paths from the sample project
const walk = (rootDir, currentDir, results = []) => {
    // Read entries in the current directory
    const entries = readdirSync(currentDir, { withFileTypes: true });

    // Process each entry
    for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        // Recurse into nested directories
        if (entry.isDirectory()) {
            walk(rootDir, fullPath, results);
            continue;
        }

        // Store file paths relative to the sample project root
        results.push(relative(rootDir, fullPath).replace(/\\/g, '/'));
    }

    // Return the collected file list
    return results;
};

// Sample project file listing tool
export default {
    // Tool definition
    name: 'list_project_files',
    description: 'Lists all files in the sample project for debugging tasks.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async (_args, context) => {
        // Resolve the sample project directory
        const projectDir = join(context.runtime.rootDir, 'project');

        // Return the discovered file list
        return {
            success: true,
            output: walk(projectDir, projectDir)
        };
    }
};