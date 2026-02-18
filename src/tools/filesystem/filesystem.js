import { readFile, writeFile, mkdir, readdir, stat, access } from 'fs/promises';
import { dirname, join, resolve, isAbsolute, normalize } from 'path';
import { checkPathForWrite, handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';

// Read file tool
export const readFileTool = {
    // Tool definition
    name: 'read_file',
    description: 'Read the full content of a file. For large files (>10k chars), ALWAYS use line_start and line_end to avoid token waste.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File path (relative or absolute).'
            },
            line_start: {
                type: 'integer',
                description: '1-based start line (optional).'
            },
            line_end: {
                type: 'integer',
                description: '1-based end line (optional). Use -1 for end of file.'
            }
        },
        required: ['path']
    },

    // Main execution function
    execute: async (args, context) => {
        const path = args.path;
        const lineStart = args.line_start;
        const lineEnd = args.line_end;
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

            // Return full content when no range is requested
            if (lineStart === undefined && lineEnd === undefined) {
                return handleToolResponse(content);
            }

            // Validate line range inputs
            if (lineStart !== undefined && (!Number.isInteger(lineStart) || lineStart < 1)) {
                return handleToolError({ message: 'line_start must be an integer >= 1.' });
            }
            if (lineEnd !== undefined && (!Number.isInteger(lineEnd) || lineEnd < -1 || lineEnd === 0)) {
                return handleToolError({ message: 'line_end must be an integer >= 1, or -1 for end of file.' });
            }

            // Split content into lines and extract the requested range (adjusting for 0-based index)
            const lines = content.split(/\r?\n/);
            const start = (lineStart ?? 1) - 1;
            const endExclusive = lineEnd === -1 || lineEnd === undefined ? lines.length : lineEnd;

            // Validate line range against file length
            if (start >= lines.length) {
                return handleToolError({ message: `line_start (${lineStart}) is beyond end of file (${lines.length} lines).` });
            }
            if (endExclusive < start + 1) {
                return handleToolError({ message: 'line_end must be greater than or equal to line_start.' });
            }

            // Extract the requested line range
            const sliced = lines.slice(start, Math.min(endExclusive, lines.length)).join('\n');

            // Return ranged content
            return handleToolResponse(sliced);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to read file' });
        }
    }
};

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

// List directory alias tool for coder workflows
export const listDirectoryTool = {
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

// Precise single-occurrence string replacement tool
export const strReplaceEditTool = {
    // Tool definition
    name: 'str_replace_edit',
    description: 'Make a precise, safe edit by replacing ONE exact occurrence of old_str with new_str. old_str MUST appear exactly once in the file (the model is trained to ensure this). This is the most reliable way to edit code.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File path (relative or absolute).'
            },
            old_str: {
                type: 'string',
                description: 'Exact text to find (including whitespace/indentation).'
            },
            new_str: {
                type: 'string',
                description: 'Replacement text.'
            }
        },
        required: ['path', 'old_str', 'new_str']
    },

    // Main execution function
    execute: async (args, context) => {
        const { path, old_str: oldStr, new_str: newStr } = args;
        const workDir = context?.workingDir || process.cwd();
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        // Check if path is allowed for writing
        if (!checkPathForWrite({ fullPath, workDir })) {
            return handleToolError({ message: 'Access denied: You can only edit files within the workspace directory.' });
        }

        try {
            // Read file content
            let content;
            try {
                content = await readFile(fullPath, 'utf-8');
            } catch {
                return handleToolError({ message: `File not found: ${path}` });
            }

            // Find the first occurrence of oldStr and ensure it appears exactly once
            const firstIndex = content.indexOf(oldStr);
            if (firstIndex === -1) {
                return handleToolError({ message: 'old_str was not found in file.' });
            }

            // Check for a second occurrence of oldStr to ensure only one replacement will be made
            const secondIndex = content.indexOf(oldStr, firstIndex + oldStr.length);
            if (secondIndex !== -1) {
                return handleToolError({ message: 'old_str appears more than once in file. Provide a more specific string.' });
            }

            // Perform the replacement
            const updated = `${content.slice(0, firstIndex)}${newStr}${content.slice(firstIndex + oldStr.length)}`;
            await writeFile(fullPath, updated, 'utf-8');

            // Return success message
            logger.debug(`Applied str_replace_edit to: ${path}`);
            return handleToolResponse(`Successfully updated ${path}`);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to apply str_replace_edit' });
        }
    }
};

// Regex/literal content search across files
export const grepSearchTool = {
    // Tool definition
    name: 'grep_search',
    description: 'Search for a pattern across files (like ripgrep). Extremely useful for finding where code is used.',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Regex or literal string to search for'
            },
            path: {
                type: 'string',
                description: 'Directory or file to search in (default: ".")'
            }
        },
        required: ['pattern']
    },

    // Main execution function
    execute: async (args, context) => {
        const pattern = args.pattern;
        const path = args.path || '.';
        const workDir = context?.workingDir || process.cwd();
        const fullPath = normalize(isAbsolute(path) ? path : resolve(workDir, path));

        // Convert the search pattern into a regex, treating it as a literal string if it's not a valid regex
        let regex;
        try {
            regex = new RegExp(pattern, 'i');
        } catch {
            const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escaped, 'i');
        }

        const matches = [];

        // Helper function to scan a file for the pattern and record matches with line numbers
        const scanFile = async (filePath, relativePath) => {
            try {
                const content = await readFile(filePath, 'utf-8');
                const lines = content.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    if (regex.test(lines[i])) {
                        matches.push({
                            path: relativePath,
                            line: i + 1,
                            content: lines[i]
                        });
                    }
                }
            } catch {
                // Skip non-text/unreadable files silently
            }
        };

        // Helper function to recursively scan directories and files
        const scanPath = async (targetPath, baseRelative = '') => {
            // Check if the path exists
            const targetStats = await stat(targetPath);

            // If it's a file, scan it for matches
            if (targetStats.isFile()) {
                const relativePath = baseRelative || path;
                await scanFile(targetPath, relativePath);
                return;
            }

            // If it's a directory, read its entries and scan them recursively
            if (!targetStats.isDirectory()) {
                return;
            }

            // Read directory entries
            const entries = await readdir(targetPath);
            for (const entry of entries) {
                const entryPath = normalize(join(targetPath, entry));
                const relativePath = baseRelative ? join(baseRelative, entry) : entry;
                await scanPath(entryPath, relativePath);
            }
        };

        try {
            // Check if the initial path exists
            try {
                await access(fullPath);
            } catch {
                return handleToolError({ message: `Path not found: ${path}` });
            }

            // Scan the path for matches
            await scanPath(fullPath);
            logger.debug(`grep_search in ${path}: pattern "${pattern}", ${matches.length} match(es)`);

            // Return matches
            return handleToolResponse({
                count: matches.length,
                matches
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to run grep_search' });
        }
    }
};