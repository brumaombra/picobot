import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, resolve, isAbsolute } from 'path';
import { checkPathForWrite } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';

// Read file tool
export const readFileTool = {
    // Tool definition
    name: 'read_file',
    description: 'Read file contents as string.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File path (relative or absolute).'
            }
        },
        required: ['path']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path;
        const workDir = context?.workingDir || process.cwd();
        const fullPath = isAbsolute(path) ? path : resolve(workDir, path);

        try {
            // Check if file exists
            if (!existsSync(fullPath)) {
                return {
                    success: false,
                    error: `File not found: ${path}`
                };
            }

            // Read file content
            const content = await readFile(fullPath, 'utf-8');
            logger.debug(`Read file: ${path} (${content.length} chars)`);

            // Return file content
            return {
                success: true,
                output: content
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: `Failed to read file: ${message}`
            };
        }
    }
};

// Write file tool
export const writeFileTool = {
    // Tool definition
    name: 'write_file',
    description: 'Write or overwrite file content.',
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
        const fullPath = isAbsolute(path) ? path : resolve(workDir, path);

        // Check if path is allowed for writing
        if (!checkPathForWrite({ fullPath, workDir })) {
            return {
                success: false,
                error: `Access denied: You can only write to the workspace directory`
            };
        }

        try {
            // Ensure directory exists
            await mkdir(dirname(fullPath), { recursive: true });

            // Write content to file
            await writeFile(fullPath, content, 'utf-8');
            logger.debug(`Wrote file: ${path} (${content.length} chars)`);

            // Return success
            return {
                success: true,
                output: `Successfully wrote ${content.length} characters to ${path}`
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: `Failed to write file: ${message}`
            };
        }
    }
};

// List directory tool
export const listDirTool = {
    // Tool definition
    name: 'list_dir',
    description: 'List files and directories in a directory.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Directory path (relative or absolute).'
            }
        },
        required: ['path']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path || '.';
        const workDir = context?.workingDir || process.cwd();
        const fullPath = isAbsolute(path) ? path : resolve(workDir, path);

        try {
            // Check if directory exists
            if (!existsSync(fullPath)) {
                return {
                    success: false,
                    error: `Directory not found: ${path}`
                };
            }

            // Read directory entries
            const entries = await readdir(fullPath);
            const details = [];

            // Get details for each entry
            for (const entry of entries) {
                const entryPath = join(fullPath, entry);

                try {
                    const stats = await stat(entryPath);
                    const type = stats.isDirectory() ? '[DIR]' : '[FILE]';
                    const size = stats.isFile() ? ` (${stats.size} bytes)` : '';
                    details.push(`${type} ${entry}${size}`);
                } catch {
                    details.push(`[???] ${entry}`);
                }
            }

            // Log directory listing
            logger.debug(`Listed directory: ${path} (${entries.length} entries)`);

            // Return directory listing
            return {
                success: true,
                output: details.join('\n') || '(empty directory)'
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: `Failed to list directory: ${message}`
            };
        }
    }
};