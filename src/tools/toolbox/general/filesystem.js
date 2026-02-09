import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, resolve, isAbsolute } from 'path';
import { checkPathForWrite } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';

// Read file tool
export const readFileTool = {
    // Tool definition
    name: 'read_file',
    description: 'Read complete contents of a file and return as string. Use for source code, configs, logs, or any text file. Binary files may be garbled.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path from workspace root (e.g., "src/config.js") or absolute path. Use forward slashes.'
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
                    output: '',
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
                output: '',
                error: `Failed to read file: ${message}`
            };
        }
    }
};

// Write file tool
export const writeFileTool = {
    // Tool definition
    name: 'write_file',
    description: `Write or overwrite a file with new content. WARNING: Completely replaces existing file contents. Parent directories created automatically. Only works within workspace directory. Use for creating files, saving code, or updating configs.`,
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path from workspace root (e.g., "output/result.txt"). Must be within workspace. Use forward slashes.'
            },
            content: {
                type: 'string',
                description: 'Complete content to write. Replaces entire file. Ensure proper formatting and newlines.'
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
                output: '',
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
                output: '',
                error: `Failed to write file: ${message}`
            };
        }
    }
};

// List directory tool
export const listDirTool = {
    // Tool definition
    name: 'list_dir',
    description: 'List all files and subdirectories in a directory. Returns names only with trailing slash for directories. Use to explore project structure or find files. Does not recurse.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to directory, relative (e.g., "src/tools") or absolute. Use "." for workspace root. Forward slashes.'
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
                    output: '',
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
                output: '',
                error: `Failed to list directory: ${message}`
            };
        }
    }
};