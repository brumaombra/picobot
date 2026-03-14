import { readFile } from 'fs/promises';
import { isAbsolute, normalize, relative, resolve } from 'path';

// Read file tool
export const readFileTool = {
    name: 'read_file',
    description: 'Read the full content of a file. For large files, use line_start and line_end to avoid token waste.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'File path, relative to the runtime root or absolute inside the runtime workspace.'
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
    execute: async ({ path, line_start, line_end }, { runtime }) => {
        const workspaceRoot = runtime.workspaceDir || runtime.rootDir || process.cwd();
        const normalizedWorkspaceRoot = normalize(resolve(workspaceRoot));
        const fullPath = normalize(isAbsolute(path) ? path : resolve(normalizedWorkspaceRoot, path));
        const relativePath = relative(normalizedWorkspaceRoot, fullPath);
        const isInsideWorkspace = relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));

        // Restrict reads to the current runtime workspace
        if (!isInsideWorkspace) {
            return {
                success: false,
                error: 'Access denied: path must stay inside the runtime workspace.'
            };
        }

        // Read the file content
        let content;
        try {
            content = await readFile(fullPath, 'utf-8');
        } catch {
            return {
                success: false,
                error: `File not found: ${path}`
            };
        }

        // Return the full content when no range is requested
        if (line_start === undefined && line_end === undefined) {
            return {
                success: true,
                output: content
            };
        }

        // Validate the line start parameter
        if (line_start !== undefined && (!Number.isInteger(line_start) || line_start < 1)) {
            return {
                success: false,
                error: 'line_start must be an integer >= 1.'
            };
        }

        // Validate the line end parameter
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

        // Validate the line range
        if (start >= lines.length) {
            return {
                success: false,
                error: `line_start (${line_start}) is beyond end of file (${lines.length} lines).`
            };
        }

        // Validate that line_end is greater than or equal to line_start
        if (endExclusive < start + 1) {
            return {
                success: false,
                error: 'line_end must be greater than or equal to line_start.'
            };
        }

        // Return the extracted content
        return {
            success: true,
            output: lines.slice(start, Math.min(endExclusive, lines.length)).join('\n')
        };
    }
};