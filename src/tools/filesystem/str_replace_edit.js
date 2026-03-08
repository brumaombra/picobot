import { readFile, writeFile } from 'fs/promises';
import { resolve, isAbsolute, normalize } from 'path';
import { isSensitivePath, handleToolError, handleToolResponse } from '../../utils/common/utils.js';
import { logger } from '../../utils/logger.js';

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
        if (!isSensitivePath({ fullPath, workDir, action: 'write' })) {
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