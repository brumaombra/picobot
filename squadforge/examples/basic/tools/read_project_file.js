import { readFileSync } from 'fs';
import { join } from 'path';

export default {
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
    execute: async ({ path }, context) => {
        const filePath = join(context.runtime.rootDir, 'project', String(path || ''));
        return {
            success: true,
            output: readFileSync(filePath, 'utf-8')
        };
    }
};
