import { readFile, readdir, stat, access } from 'fs/promises';
import { join, resolve, isAbsolute, normalize } from 'path';
import { isSensitivePath, handleToolError, handleToolResponse } from '../../utils/common/utils.js';
import { logger } from '../../utils/logger.js';

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

        // Block searching directly inside sensitive files
        if (!isSensitivePath({ fullPath, workDir, action: 'read' })) {
            return handleToolError({ message: 'Access denied: This path is marked as sensitive.' });
        }

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
            // Skip sensitive files/directories to prevent accidental secret disclosure
            if (!isSensitivePath({ fullPath: targetPath, workDir, action: 'read' })) {
                return;
            }

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