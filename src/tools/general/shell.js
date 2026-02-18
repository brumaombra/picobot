import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.js';
import { SHELL_MAX_OUTPUT_LENGTH, SHELL_MAX_BUFFER } from '../../config.js';
import { checkShellCommand, handleToolError, handleToolResponse } from '../../utils/utils.js';

const execAsync = promisify(exec);

// Coder-focused shell alias tool
export const runTerminalCmdTool = {
    // Tool definition
    name: 'run_terminal_cmd',
    description: 'Run any shell command (git, tests, lint, python, npm, etc.). This is the most powerful tool — use it to test changes, run the app, commit, etc.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Shell command to execute.'
            },
            timeout_seconds: {
                type: 'integer',
                description: 'Optional timeout (default 60).'
            }
        },
        required: ['command']
    },

    // Main execution function
    execute: async (args, context) => {
        const command = args.command;
        const cwd = context?.workingDir || process.cwd();
        const timeoutSeconds = Number.isInteger(args.timeout_seconds) && args.timeout_seconds > 0 ? args.timeout_seconds : 60;
        const timeoutMs = timeoutSeconds * 1000;

        // Security check to prevent dangerous commands
        const safetyCheck = checkShellCommand({ command, workDir: cwd });
        if (!safetyCheck.safe) {
            return handleToolError({ message: safetyCheck.reason });
        }

        // Log the command being executed
        logger.debug(`Executing run_terminal_cmd: ${command}`);

        try {
            // Execute the command with a timeout and buffer limit
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: timeoutMs,
                maxBuffer: SHELL_MAX_BUFFER,
                shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
            });

            // Combine stdout and stderr, and truncate if too long
            let output = stdout || '';
            if (stderr) {
                output += (output ? '\n' : '') + `[stderr] ${stderr}`;
            }

            // Truncate output if it exceeds the maximum length
            if (output.length > SHELL_MAX_OUTPUT_LENGTH) {
                output = output.slice(0, SHELL_MAX_OUTPUT_LENGTH) + '\n... (output truncated)';
            }

            // Return the command output
            return handleToolResponse(output || '(no output)');
        } catch (error) {
            return handleToolError({ error, message: 'run_terminal_cmd failed' });
        }
    }
};