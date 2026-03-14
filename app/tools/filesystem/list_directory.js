import { readdir, stat, access } from 'fs/promises';
import { join, resolve, isAbsolute, normalize } from 'path';
import { isSensitivePath, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { logger } from '../../../src/utils/common/logger.js';

// List directory tool
const listDirectoryTool = {
    // Tool definition
    name: 'list_directory',
    description: 'List all files and subdirectories in a path. Always use this first to explore the codebase.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Directory path. Use "." for current working directory.'
            },
            recursive: {
                type: 'boolean',
                description: 'If true, list all files and directories recursively. Default is false.'
            }
        },
        required: ['path']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path || '.';
        const recursive = args.recursive || false;
        const workDir = context?.workingDir || process.cwd();
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        // Block listing sensitive directories/files directly
        if (!isSensitivePath({ fullPath, workDir, action: 'read' })) {
            return handleToolError({ message: 'Access denied: This path is marked as sensitive.' });
        }

        try {
            // Check if directory exists
            try {
                await access(fullPath);
            } catch {
                return handleToolError({ message: `Directory not found: ${path}` });
            }

            // Helper function to list directory contents recursively
            const listRecursive = async (dirPath, basePath = '') => {
                const entries = await readdir(dirPath);
                const details = [];

                // Process each entry in the directory
                for (const entry of entries) {
                    const entryPath = normalize(join(dirPath, entry));
                    const relativePath = basePath ? join(basePath, entry) : entry;

                    // Hide sensitive entries from directory listings
                    if (!isSensitivePath({ fullPath: entryPath, workDir, action: 'read' })) {
                        continue;
                    }

                    try {
                        // Get stats to determine if it's a file or directory and gather details
                        const stats = await stat(entryPath);
                        const item = {
                            path: relativePath,
                            name: entry,
                            type: stats.isDirectory() ? 'directory' : 'file'
                        };

                        // Include file size if it's a file
                        if (stats.isFile()) {
                            item.size = stats.size;
                        }

                        // Add the item to the details list
                        details.push(item);

                        // Recursively list subdirectories if requested
                        if (stats.isDirectory() && recursive) {
                            const subDetails = await listRecursive(entryPath, relativePath);
                            details.push(...subDetails);
                        }
                    } catch (statError) {
                        const errorMsg = statError instanceof Error ? statError.message : String(statError);
                        logger.warn(`Failed to stat "${entry}" in ${dirPath}: ${errorMsg}`);
                        details.push({
                            path: relativePath,
                            name: entry,
                            type: 'unknown',
                            error: 'Could not determine type'
                        });
                    }
                }

                // Return the list of directory entries with details
                return details;
            };

            // List directory contents
            const details = await listRecursive(fullPath);
            logger.debug(`Listed directory: ${path} (${details.length} entries, recursive: ${recursive})`);

            // If empty, return a message instead of an empty list
            if (details.length === 0) {
                return handleToolResponse('No entries found.');
            }

            // Return the list of entries with details
            return handleToolResponse(details);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to list directory' });
        }
    }
};

// Export the tool as the default export of this module
export default listDirectoryTool;