import { readFile, writeFile, mkdir, readdir, stat, access, unlink, rm, rename, copyFile } from 'fs/promises';
import { dirname, join, resolve, isAbsolute, normalize } from 'path';
import { checkPathForWrite, handleToolError, handleToolResponse } from '../../utils/utils.js';
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
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        try {
            // Check if file exists using async access instead of sync existsSync
            try {
                await access(fullPath);
            } catch {
                return handleToolError({ message: `File not found: ${path}` });
            }

            // Read file content
            const content = await readFile(fullPath, 'utf-8');
            logger.debug(`Read file: ${path} (${content.length} chars)`);

            // Return file content
            return handleToolResponse(content);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to read file' });
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
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        // Check if path is allowed for writing
        if (!checkPathForWrite({ fullPath, workDir })) {
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

        try {
            // Check if directory exists using async access
            try {
                await access(fullPath);
            } catch {
                return handleToolError({ message: `Directory not found: ${path}` });
            }

            // Helper function to recursively list directories
            const listRecursive = async (dirPath, basePath = '') => {
                const entries = await readdir(dirPath);
                const details = [];

                // Process each entry in the directory
                for (const entry of entries) {
                    const entryPath = normalize(join(dirPath, entry));
                    const relativePath = basePath ? join(basePath, entry) : entry;

                    try {
                        // Get stats to determine if it's a file or directory
                        const stats = await stat(entryPath);

                        // Build item details
                        const item = {
                            path: relativePath,
                            name: entry,
                            type: stats.isDirectory() ? 'directory' : 'file'
                        };

                        // Include file size if it's a file
                        if (stats.isFile()) {
                            item.size = stats.size;
                        }

                        // Add item to the list
                        details.push(item);

                        // Recursively process subdirectories
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

                // Return the list
                return details;
            };

            // Get directory listing (recursive or not)
            const details = await listRecursive(fullPath);

            // Log directory listing
            logger.debug(`Listed directory: ${path} (${details.length} entries, recursive: ${recursive})`);

            // Return empty array message if no entries
            if (details.length === 0) {
                return handleToolResponse('No entries found.');
            }

            // Return directory listing as structured data
            return handleToolResponse(details);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to list directory' });
        }
    }
};

// Delete tool (handles both files and directories)
export const deleteTool = {
    // Tool definition
    name: 'delete',
    description: 'Delete a file or directory. Automatically detects the type.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File or directory path (relative to workspace).'
            },
            recursive: {
                type: 'boolean',
                description: 'If true and path is a directory, delete it and all its contents recursively. Default is false.'
            }
        },
        required: ['path']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path;
        const recursive = args.recursive || false;
        const workDir = context?.workingDir || process.cwd();
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        // Check if path is allowed for writing
        if (!checkPathForWrite({ fullPath, workDir })) {
            return handleToolError({ message: 'Access denied: You can only delete within the workspace directory' });
        }

        try {
            // Check if path exists
            try {
                await access(fullPath);
            } catch {
                return handleToolError({ message: `Path not found: ${path}` });
            }

            // Check if it's a file or directory
            const stats = await stat(fullPath);
            if (stats.isFile()) {
                // Delete file
                await unlink(fullPath);
                logger.debug(`Deleted file: ${path}`);

                // Return success message
                return handleToolResponse(`Successfully deleted file: ${path}`);
            } else if (stats.isDirectory()) {
                // Delete directory
                await rm(fullPath, { recursive });
                logger.debug(`Deleted directory: ${path} (recursive: ${recursive})`);

                // Return success message
                return handleToolResponse(`Successfully deleted directory: ${path}`);
            } else {
                return handleToolError({ message: `Path is neither a file nor a directory: ${path}` });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            // Provide helpful error for non-empty directories
            if (message.includes('not empty') || message.includes('ENOTEMPTY')) {
                return handleToolError({ message: `Directory is not empty: ${path}. Set recursive=true to delete non-empty directories.` });
            }

            // Return generic error message
            return handleToolError({ error, message: 'Failed to delete' });
        }
    }
};

// Rename/move file tool
export const renameFileTool = {
    // Tool definition
    name: 'rename_file',
    description: 'Rename or move a file or directory.',
    parameters: {
        type: 'object',
        properties: {
            oldPath: {
                type: 'string',
                description: 'Current file/directory path (relative to workspace).'
            },
            newPath: {
                type: 'string',
                description: 'New file/directory path (relative to workspace).'
            }
        },
        required: ['oldPath', 'newPath']
    },

    // Main execution function
    execute: async (args, context) => {
        const oldPath = args.oldPath;
        const newPath = args.newPath;
        const workDir = context?.workingDir || process.cwd();
        const fullOldPath = normalize(isAbsolute(oldPath) ? oldPath : resolve(workDir, oldPath));
        const fullNewPath = normalize(isAbsolute(newPath) ? newPath : resolve(workDir, newPath));

        // Check if the source path is allowed for writing
        if (!checkPathForWrite({ fullPath: fullOldPath, workDir })) {
            return handleToolError({ message: 'Access denied: Source path must be in the workspace directory' });
        }

        // Check if the destination path is allowed for writing
        if (!checkPathForWrite({ fullPath: fullNewPath, workDir })) {
            return handleToolError({ message: 'Access denied: Destination path must be in the workspace directory' });
        }

        try {
            // Check if source exists
            try {
                await access(fullOldPath);
            } catch {
                return handleToolError({ message: `Source not found: ${oldPath}` });
            }

            // Ensure destination directory exists
            await mkdir(dirname(fullNewPath), { recursive: true });

            // Rename/move the file or directory
            await rename(fullOldPath, fullNewPath);
            logger.debug(`Renamed/moved: ${oldPath} -> ${newPath}`);

            // Return success message
            return handleToolResponse(`Successfully renamed/moved from ${oldPath} to ${newPath}`);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to rename/move' });
        }
    }
};

// Copy file tool
export const copyFileTool = {
    // Tool definition
    name: 'copy_file',
    description: 'Copy a file to a new location.',
    parameters: {
        type: 'object',
        properties: {
            sourcePath: {
                type: 'string',
                description: 'Source file path (relative or absolute).'
            },
            destPath: {
                type: 'string',
                description: 'Destination file path (relative to workspace).'
            }
        },
        required: ['sourcePath', 'destPath']
    },

    // Main execution function
    execute: async (args, context) => {
        const sourcePath = args.sourcePath;
        const destPath = args.destPath;
        const workDir = context?.workingDir || process.cwd();
        const fullSourcePath = normalize(isAbsolute(sourcePath) ? sourcePath : resolve(workDir, sourcePath));
        const fullDestPath = normalize(isAbsolute(destPath) ? destPath : resolve(workDir, destPath));

        // Check if destination path is allowed for writing
        if (!checkPathForWrite({ fullPath: fullDestPath, workDir })) {
            return handleToolError({ message: 'Access denied: Destination path must be in the workspace directory' });
        }

        try {
            // Check if source exists
            try {
                await access(fullSourcePath);
            } catch {
                return handleToolError({ message: `Source file not found: ${sourcePath}` });
            }

            // Check if source is a file
            const stats = await stat(fullSourcePath);
            if (!stats.isFile()) {
                return handleToolError({ message: `Source is not a file: ${sourcePath}` });
            }

            // Ensure destination directory exists
            await mkdir(dirname(fullDestPath), { recursive: true });

            // Copy the file
            await copyFile(fullSourcePath, fullDestPath);
            logger.debug(`Copied file: ${sourcePath} -> ${destPath}`);

            // Return success message
            return handleToolResponse(`Successfully copied file from ${sourcePath} to ${destPath}`);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to copy file' });
        }
    }
};

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

// File search tool
export const fileSearchTool = {
    // Tool definition
    name: 'file_search',
    description: 'Search for files by name pattern in a directory.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Directory path to search in (relative or absolute).'
            },
            pattern: {
                type: 'string',
                description: 'Search pattern (supports wildcards: * for any characters, ? for single character).'
            },
            recursive: {
                type: 'boolean',
                description: 'If true, search recursively in subdirectories. Default is true.'
            },
            caseSensitive: {
                type: 'boolean',
                description: 'If true, pattern matching is case-sensitive. Default is false.'
            }
        },
        required: ['path', 'pattern']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path || '.';
        const pattern = args.pattern;
        const recursive = args.recursive !== false; // Default true
        const caseSensitive = args.caseSensitive || false;
        const workDir = context?.workingDir || process.cwd();
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        try {
            // Check if directory exists
            try {
                await access(fullPath);
            } catch {
                return handleToolError({ message: `Directory not found: ${path}` });
            }

            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
                .replace(/\*/g, '.*') // * matches any characters
                .replace(/\?/g, '.'); // ? matches single character

            // Create regex with start and end anchors
            const regex = new RegExp(`^${regexPattern}$`, caseSensitive ? '' : 'i');

            // Helper function to search recursively
            const searchRecursive = async (dirPath, basePath = '') => {
                const entries = await readdir(dirPath);
                const matches = [];

                // Process each entry in the directory
                for (const entry of entries) {
                    const entryPath = normalize(join(dirPath, entry));
                    const relativePath = basePath ? join(basePath, entry) : entry;

                    try {
                        // Get stats to determine if it's a file or directory
                        const stats = await stat(entryPath);

                        // Check if entry name matches pattern
                        if (regex.test(entry)) {
                            matches.push({
                                path: relativePath,
                                name: entry,
                                type: stats.isDirectory() ? 'directory' : 'file',
                                size: stats.isFile() ? stats.size : undefined
                            });
                        }

                        // Recursively search subdirectories
                        if (stats.isDirectory() && recursive) {
                            const subMatches = await searchRecursive(entryPath, relativePath);
                            matches.push(...subMatches);
                        }
                    } catch (statError) {
                        // Skip entries we can't access
                        const errorMsg = statError instanceof Error ? statError.message : String(statError);
                        logger.warn(`Skipping "${entry}" in search: ${errorMsg}`);
                    }
                }

                return matches;
            };

            // Search for matching files
            const matches = await searchRecursive(fullPath);

            // Log search results
            logger.debug(`File search in ${path}: pattern "${pattern}", found ${matches.length} matches`);

            // Return results
            if (matches.length === 0) {
                return handleToolResponse('No files found matching the pattern.');
            }

            // Return list of matching files
            return handleToolResponse(matches);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to search files' });
        }
    }
};