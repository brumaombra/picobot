import { readFileSync } from 'fs';
import { join } from 'path';

// Sample project file reader tool
export default {
    // Tool definition
    name: 'read_project_file',
    description: 'Reads a file from the sample project.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path relative to the sample project root.'
            }
        },
        required: ['path']
    },

    // Main execution function
    execute: async ({ path }, context) => {
        // Resolve the requested file under the sample project root
        const filePath = join(context.runtime.rootDir, 'project', String(path || ''));

        // Return the file contents
        return {
            success: true,
            output: readFileSync(filePath, 'utf-8')
        };
    }
};