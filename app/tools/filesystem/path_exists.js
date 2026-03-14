import { stat, access } from 'fs/promises';
import { resolve, isAbsolute, normalize } from 'path';
import { isSensitivePath, handleToolError, handleToolResponse } from '../../utils/common/utils.js';
import { logger } from '../../utils/common/logger.js';

// Path exists tool
export const pathExistsTool = {
    // Tool definition
    name: 'path_exists',
    description: 'Check if a file or directory exists.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File or directory path (relative or absolute).'
            }
        },
        required: ['path']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path;
        const workDir = context?.workingDir || process.cwd();
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        // Block probing sensitive files
        if (!isSensitivePath({ fullPath, workDir, action: 'read' })) {
            return handleToolError({ message: 'Access denied: This path is marked as sensitive.' });
        }

        try {
            // Try to access the path
            await access(fullPath);

            // Get stats to determine type
            const stats = await stat(fullPath);
            const type = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';

            // Log the path check result
            logger.debug(`Path exists check: ${path} (${type})`);

            // Return existence and type information
            return handleToolResponse({
                exists: true,
                type,
                size: stats.isFile() ? stats.size : undefined
            });
        } catch (error) {
            // Path doesn't exist or not accessible
            logger.debug(`Path exists check failed: ${path}`);
            return handleToolResponse({
                exists: false
            });
        }
    }
};