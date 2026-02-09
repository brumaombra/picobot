import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.js';
import { SHELL_MAX_OUTPUT_LENGTH, SHELL_DEFAULT_TIMEOUT_MS, SHELL_MAX_BUFFER } from '../../config.js';
import { checkShellCommand } from '../../utils/utils.js';

const execAsync = promisify(exec);

// Shell tool
export const shellTool = {
    // Tool definition
    name: 'shell',
    description: 'Execute shell command.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Shell command to execute.'
            },
            cwd: {
                type: 'string',
                description: 'Working directory (optional).'
            }
        },
        required: ['command']
    },

    // Main execution function
    execute: async (args, context) => {
        const command = args.command;
        const cwd = args.cwd || context?.workingDir || process.cwd();

        // Check if command is safe to execute
        const safetyCheck = checkShellCommand({ command, workDir: cwd });
        if (!safetyCheck.safe) {
            return {
                success: false,
                error: safetyCheck.reason
            };
        }

        // Log command execution
        logger.debug(`Executing shell command: ${command}`);

        try {
            // Execute the command
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: SHELL_DEFAULT_TIMEOUT_MS,
                maxBuffer: SHELL_MAX_BUFFER,
                shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
            });

            // Combine stdout and stderr
            let output = stdout || '';
            if (stderr) {
                output += (output ? '\n' : '') + `[stderr] ${stderr}`;
            }

            // Truncate if too long
            if (output.length > SHELL_MAX_OUTPUT_LENGTH) {
                output = output.slice(0, SHELL_MAX_OUTPUT_LENGTH) + '\n... (output truncated)';
            }

            // Return success
            return {
                success: true,
                output: output || '(no output)'
            };
        } catch (error) {
            const stdout = error.stdout || '';
            const stderr = error.stderr || '';
            const message = error.message || String(error);

            // Combine stdout and stderr
            let output = stdout;
            if (stderr) {
                output += (output ? '\n' : '') + stderr;
            }

            // Truncate if too long
            if (output.length > SHELL_MAX_OUTPUT_LENGTH) {
                output = output.slice(0, SHELL_MAX_OUTPUT_LENGTH) + '\n... (output truncated)';
            }

            // Return error
            return {
                success: false,
                output: output || '',
                error: message
            };
        }
    }
};