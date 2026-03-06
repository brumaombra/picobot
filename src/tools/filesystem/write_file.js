import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve, isAbsolute, normalize } from 'path';
import { isSensitivePath, handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';

// Write file tool
export const writeFileTool = {
    // Tool definition
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing file with new content. Best for new files or full rewrites.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File path (relative to workspace).'
            },
            content: {
                type: 'string',
                description: 'Content to write.'
            }
        },
        required: ['path', 'content']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path;
        const content = args.content;
        const workDir = context?.workingDir || process.cwd();
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        // Check if path is allowed for writing
        if (!isSensitivePath({ fullPath, workDir, action: 'write' })) {
            return handleToolError({ message: 'Access denied: You can only write to the workspace directory' });
        }

        try {
            // Ensure directory exists
            await mkdir(dirname(fullPath), { recursive: true });

            // Write content to file
            await writeFile(fullPath, content, 'utf-8');
            logger.debug(`Wrote file: ${path} (${content.length} chars)`);

            // Return success
            return handleToolResponse(`Successfully wrote ${content.length} characters to ${path}`);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to write file' });
        }
    }
};