import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { logger } from '../../utils/common/logger.js';
import { handleToolError, handleToolResponse, generateUniqueId } from '../../utils/common/utils.js';
import { BROWSER_DEFAULT_TIMEOUT_MS, BROWSER_MAX_CONTENT_LENGTH, BROWSER_HEADED, SCREENSHOTS_DIR } from '../../config.js';

// Promisified version of execFile for async/await usage
const execFileAsync = promisify(execFile);
const NPX_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Current browser session name (unique per open/close cycle)
let currentSession = null;

// List of supported browser commands
const BROWSER_COMMANDS = [
    'open',
    'snapshot',
    'click',
    'type',
    'fill',
    'press',
    'hover',
    'select',
    'check',
    'uncheck',
    'scroll',
    'screenshot',
    'eval',
    'get',
    'wait',
    'back',
    'forward',
    'reload',
    'close',
    'tab'
];

/******************************** Agent Browser CLI Runner ********************************/

// Clean environment: strip Node.js debugger variables to prevent auto-attach on child processes
const cleanEnv = () => {
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.VSCODE_INSPECTOR_OPTIONS;
    return env;
};

// Run an agent-browser command via npx and return its stdout
const runCli = async (args, timeoutMs = BROWSER_DEFAULT_TIMEOUT_MS) => {
    // Inject session flag if a session is active
    if (currentSession) {
        args = ['--session', currentSession, ...args];
    }

    // Log the command being executed
    logger.debug(`npx agent-browser ${args.join(' ')}`);

    try {
        // Execute the command
        const { stdout } = await execFileAsync(NPX_BIN, ['agent-browser', ...args], {
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024,
            windowsHide: true,
            env: cleanEnv()
        });

        // Get the output
        let output = (stdout || '').trim();

        // Truncate if needed
        if (output.length > BROWSER_MAX_CONTENT_LENGTH) {
            output = output.slice(0, BROWSER_MAX_CONTENT_LENGTH) + '\n… (truncated)';
        }

        // Return output
        return output || '(no output)';
    } catch (error) {
        // If the process exited with output, return it along with the error
        const stdout = (error.stdout || '').trim();
        const stderr = (error.stderr || '').trim();
        const combined = [stdout, stderr].filter(Boolean).join('\n');
        throw new Error(combined || error.message);
    }
};

// Parse a raw command string into an args array, respecting quoted strings
const parseCommand = raw => {
    const args = [];
    let current = '';
    let inQuote = null;

    // Simple state machine to split on whitespace while respecting quoted substrings
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];

        // Handle quote boundaries
        if ((ch === '"' || ch === "'") && !inQuote) { inQuote = ch; continue; }
        if (ch === inQuote) { inQuote = null; continue; }

        // Split on unquoted whitespace
        if (!inQuote && /\s/.test(ch)) {
            if (current) { args.push(current); current = ''; }
            continue;
        }

        // Append character to current arg
        current += ch;
    }

    // Push the last arg if exists
    if (current) args.push(current);
    return args;
};

/******************************** Single Browser Tool ********************************/

// Browser tool
export const browserTool = {
    // Tool definition
    name: 'browser',
    description: 'Run an agent-browser command for browser automation. Pass a valid command name with its arguments.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Agent-browser command (without the "agent-browser" prefix).'
            }
        },
        required: ['command']
    },

    // Main execution function
    execute: async ({ command }) => {
        // Validate command presence
        if (!command?.trim()) {
            return handleToolError({ message: 'No command provided. Try "open https://example.com" or "snapshot".' });
        }

        // Parse the command into args
        const args = parseCommand(command.trim());
        const commandName = args[0];

        // Validate command against the known list
        if (!BROWSER_COMMANDS.includes(commandName)) {
            return handleToolError({ message: `Unknown browser command "${commandName}". Available commands: ${BROWSER_COMMANDS.join(', ')}` });
        }

        try {
            // Execute the command and return the output
            logger.debug(`browser tool: ${command}`);

            // Start a new session on open, clear it on close
            if (commandName === 'open') {
                // Close existing session before opening a new one
                if (currentSession) {
                    logger.debug(`Closing previous browser session: ${currentSession}`);
                    try { await runCli(['close']); } catch { /* ignore close errors */ }
                }

                // Generate a new unique session name for this browser instance
                currentSession = generateUniqueId('browser');
                if (BROWSER_HEADED) args.push('--headed'); // Add headed flag if configured
                logger.debug(`New browser session: ${currentSession}`);
            } else if (commandName === 'close') {
                currentSession = null;
            }

            // For screenshot commands, always save to the screenshots directory
            if (commandName === 'screenshot') {
                // Find the filename arg (first arg that doesn't start with -)
                const filenameIndex = args.findIndex((arg, index) => index > 0 && !arg.startsWith('-'));
                const filename = filenameIndex !== -1 ? args[filenameIndex] : `${generateUniqueId('screenshot')}.png`;

                // Replace or insert the full path
                const fullPath = join(SCREENSHOTS_DIR, filename);
                if (filenameIndex !== -1) {
                    args[filenameIndex] = fullPath;
                } else {
                    args.splice(1, 0, fullPath);
                }

                // Create screenshots directory if it doesn't exist
                mkdirSync(SCREENSHOTS_DIR, { recursive: true });
            }

            // Execute the CLI command and handle the response
            const output = await runCli(args);
            return handleToolResponse(output);
        } catch (error) {
            return handleToolError({ error, message: 'Browser command failed' });
        }
    }
};