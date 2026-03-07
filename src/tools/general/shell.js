import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.js';
import { SHELL_MAX_OUTPUT_LENGTH, SHELL_MAX_BUFFER, SHELL_DEFAULT_TIMEOUT_MS } from '../../config.js';
import { handleToolError, handleToolResponse, tokenizeArgs } from '../../utils/utils.js';

// Promisified version of execFile for async/await usage
const execFileAsync = promisify(execFile);

// Allowed args by action key
const ALLOWED_ARGS = {
    // Git
    git: [
        'status',
        'status --short',
        'diff',
        'diff --staged',
        'diff --name-only',
        'log --oneline -n 20',
        'log --oneline -n 5',
        'show --stat --oneline -n 1',
        'show --name-only --oneline -n 1',
        'branch',
        'branch --show-current',
        'branch --list',
        'branch --all',
        'rev-parse --abbrev-ref HEAD',
        'rev-parse --short HEAD'
    ],

    // Npm
    npm: [
        'test',
        'run lint',
        'start',
        'run start'
    ],

    // Node
    node: [
        '--version'
    ],

    // Python
    python: [
        '--version'
    ]
};

// Precompute allowed arg sets for efficient validation
const ALLOWED_ARG_SETS = Object.fromEntries(
    Object.entries(ALLOWED_ARGS).map(([action, allowedList]) => [action, new Set(allowedList)])
);

// Reusable builder for actions validated by tokenized args + allowlist
const createAllowlistedActionBuilder = ({ action, resolveFile, defaultArgv }) => ({
    build: actionArgs => {
        // Tokenize the args
        const rawArgs = typeof actionArgs === 'string' ? actionArgs : String(actionArgs || '');
        const argv = rawArgs.trim() === '' ? [...defaultArgv] : tokenizeArgs(rawArgs);
        const key = argv.join(' ');
        const allowedList = ALLOWED_ARGS[action] || [];
        const allowedSet = ALLOWED_ARG_SETS[action] || new Set();

        // Validate the tokenized args against the allowlist
        if (!allowedSet.has(key)) {
            throw new Error(`Invalid ${action} args. Allowed examples: ${allowedList.map(item => `"${item}"`).join(', ')}`);
        }

        // Return the resolved file and args for execution
        return { file: resolveFile(), args: argv };
    }
});

// Allowed high-level actions for command execution
const COMMAND_ACTIONS = {
    // Run the git command
    git: createAllowlistedActionBuilder({
        action: 'git',
        resolveFile: () => 'git',
        defaultArgv: ['status']
    }),

    // Run the npm command
    npm: createAllowlistedActionBuilder({
        action: 'npm',
        resolveFile: () => (process.platform === 'win32' ? 'npm.cmd' : 'npm'),
        defaultArgv: ['test']
    }),

    // Run the node command
    node: createAllowlistedActionBuilder({
        action: 'node',
        resolveFile: () => (process.platform === 'win32' ? 'node.exe' : 'node'),
        defaultArgv: ['--version']
    }),

    // Run the python command
    python: createAllowlistedActionBuilder({
        action: 'python',
        resolveFile: () => (process.platform === 'win32' ? 'python.exe' : 'python'),
        defaultArgv: ['--version']
    })
};

// Extract action names for validation
const ACTION_NAMES = Object.keys(COMMAND_ACTIONS);

// Coder-focused shell alias tool
export const runTerminalCmdTool = {
    // Tool definition
    name: 'run_terminal_cmd',
    description: 'Run a terminal command.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                enum: ACTION_NAMES,
                description: 'Command to execute.'
            },
            args: {
                type: 'string',
                description: 'Optional command-specific arguments as a string. Examples: "status" for command "git".'
            }
        },
        required: ['command']
    },

    // Main execution function
    execute: async (toolArgs, context) => {
        const command = String(toolArgs.command || '').trim();
        const cwd = context?.workingDir || process.cwd();
        const hasArgs = Object.prototype.hasOwnProperty.call(toolArgs || {}, 'args');
        const actionArgs = hasArgs ? toolArgs.args : '';

        // Check if the action is valid and build the command specification
        const actionDef = COMMAND_ACTIONS[command];
        if (!actionDef) {
            return handleToolError({ message: `Unknown command "${command}". Allowed commands: ${ACTION_NAMES.join(', ')}` });
        }

        // Build the command specification (file + args) using the action definition
        let commandSpec;
        try {
            commandSpec = actionDef.build(actionArgs);
        } catch (error) {
            return handleToolError({ error, message: `Invalid parameters for command "${command}"` });
        }

        // Prepare the command label
        const file = commandSpec.file;
        const commandArgs = Array.isArray(commandSpec.args) ? commandSpec.args : [];
        const commandLabel = [file, ...commandArgs].join(' ');

        // Log the command being executed
        logger.debug(`Executing run_terminal_cmd command [${command}]: ${commandLabel}`);

        try {
            // Execute an explicit executable + args (no shell parsing)
            const { stdout, stderr } = await execFileAsync(file, commandArgs, {
                cwd,
                timeout: SHELL_DEFAULT_TIMEOUT_MS,
                maxBuffer: SHELL_MAX_BUFFER,
                windowsHide: true
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

            // Return the command output with metadata for better auditability
            return handleToolResponse({
                command,
                executed_command: commandLabel,
                output: output || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: `run_terminal_cmd failed for command "${command}"` });
        }
    }
};