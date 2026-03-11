import { access, readFile } from 'fs/promises';
import { isAbsolute, normalize, resolve } from 'path';

// Create the built-in read_file tool for the current agent context
export const createReadFileTool = ({ squad }) => {
    // Tool definition
    return {
        name: 'read_file',
        description: 'Read the full content of a file. For large files, use line_start and line_end to avoid token waste.',
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'File path, relative to the squad root or absolute inside the squad workspace.'
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
        execute: async ({ path, line_start, line_end }) => {
            const workspaceRoot = squad.rootDir || process.cwd();
            const normalizedWorkspaceRoot = normalize(resolve(workspaceRoot));
            const fullPath = normalize(isAbsolute(path) ? path : resolve(normalizedWorkspaceRoot, path));

            // Restrict reads to the current squad workspace
            if (!fullPath.startsWith(normalizedWorkspaceRoot)) {
                return {
                    success: false,
                    error: 'Access denied: path must stay inside the squad workspace.'
                };
            }

            // Validate the file exists
            try {
                await access(fullPath);
            } catch {
                return {
                    success: false,
                    error: `File not found: ${path}`
                };
            }

            // Read the file content
            const content = await readFile(fullPath, 'utf-8');

            // Return the full content when no range is requested
            if (line_start === undefined && line_end === undefined) {
                return {
                    success: true,
                    output: content
                };
            }

            // Validate the requested line range
            if (line_start !== undefined && (!Number.isInteger(line_start) || line_start < 1)) {
                return {
                    success: false,
                    error: 'line_start must be an integer >= 1.'
                };
            }

            if (line_end !== undefined && (!Number.isInteger(line_end) || line_end < -1 || line_end === 0)) {
                return {
                    success: false,
                    error: 'line_end must be an integer >= 1, or -1 for end of file.'
                };
            }

            // Extract the requested range
            const lines = content.split(/\r?\n/);
            const start = (line_start ?? 1) - 1;
            const endExclusive = line_end === -1 || line_end === undefined ? lines.length : line_end;

            if (start >= lines.length) {
                return {
                    success: false,
                    error: `line_start (${line_start}) is beyond end of file (${lines.length} lines).`
                };
            }

            if (endExclusive < start + 1) {
                return {
                    success: false,
                    error: 'line_end must be greater than or equal to line_start.'
                };
            }

            return {
                success: true,
                output: lines.slice(start, Math.min(endExclusive, lines.length)).join('\n')
            };
        }
    };
};