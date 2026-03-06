import { readFile } from 'fs/promises';
import { resolve, isAbsolute, normalize } from 'path';
import { access } from 'fs/promises';
import { isSensitivePath, handleToolError, handleToolResponse } from '../../utils/utils.js';
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

        // Block read access to sensitive files containing secrets
        if (!isSensitivePath({ fullPath, workDir, action: 'read' })) {
            return handleToolError({ message: 'Access denied: This file is marked as sensitive.' });
        }

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