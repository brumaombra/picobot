import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { BROWSER_DEFAULT_TIMEOUT_MS, BROWSER_MAX_CONTENT_LENGTH } from '../../config.js';

// Promisified version of execFile for async/await usage
const execFileAsync = promisify(execFile);

/******************************** Available Commands ********************************/

// List of supported browser commands (core set — use `eval` for advanced/niche operations)
const BROWSER_COMMANDS = [
    { name: 'open', description: 'Navigate/open browser (optionally to a URL). Usage: open <url>' },
    { name: 'snapshot', description: 'Get page accessibility snapshot with element [ref] markers. Usage: snapshot [-d <depth>] [-s <selector>]' },
    { name: 'click', description: 'Click an element by ref or selector. Usage: click <ref|selector>' },
    { name: 'type', description: 'Type text into an element. Usage: type <ref|selector> <text>' },
    { name: 'fill', description: 'Clear and fill a field by ref. Usage: fill <ref|selector> <text>' },
    { name: 'press', description: 'Press a key (Enter, Tab, Escape, Control+a, etc.). Usage: press <key>' },
    { name: 'hover', description: 'Hover over an element. Usage: hover <ref|selector>' },
    { name: 'select', description: 'Select a dropdown option. Usage: select <ref|selector> <value>' },
    { name: 'check', description: 'Check a checkbox. Usage: check <ref|selector>' },
    { name: 'uncheck', description: 'Uncheck a checkbox. Usage: uncheck <ref|selector>' },
    { name: 'scroll', description: 'Scroll the page. Usage: scroll <up|down|left|right> [px]' },
    { name: 'screenshot', description: 'Take a screenshot. Usage: screenshot [path] [--full]' },
    { name: 'eval', description: 'Evaluate JavaScript on the page. Usage: eval <js>' },
    { name: 'get', description: 'Get element info. Usage: get <text|html|value|attr|title|url|count|box> [ref|selector] [attr]' },
    { name: 'wait', description: 'Wait for element, time, text, URL, or load state. Usage: wait <selector|ms> [--text|--url|--load|--fn]' },
    { name: 'back', description: 'Navigate back in browser history.' },
    { name: 'forward', description: 'Navigate forward in browser history.' },
    { name: 'reload', description: 'Reload the current page.' },
    { name: 'close', description: 'Close the browser.' },
    { name: 'tab', description: 'List, open, switch, or close tabs. Usage: tab [new [url] | <n> | close [n]]' }
];

// Returns the list of available command names
export const getBrowserCommands = () => {
    return BROWSER_COMMANDS.map(command => command.name);
};

// Generates a formatted prompt section describing all browser commands
export const generateBrowserCommandsPrompt = () => {
    const lines = BROWSER_COMMANDS.map(command => `\`${command.name}\` - ${command.description}`);
    return lines.join('\n');
};

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
    logger.debug(`npx agent-browser ${args.join(' ')}`);

    try {
        // Execute the command
        const { stdout } = await execFileAsync('npx', ['agent-browser', ...args], {
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024,
            shell: true,
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
        if (!getBrowserCommands().includes(commandName)) {
            return handleToolError({ message: `Unknown browser command "${commandName}". Available commands: ${getBrowserCommands().join(', ')}` });
        }

        try {
            // Execute the command and return the output
            logger.debug(`browser tool: ${command}`);

            // For snapshot commands, always force -i (interactive only)
            if (commandName === 'snapshot') {
                if (!args.includes('-i')) args.splice(1, 0, '-i');
            }

            // Execute the CLI command and handle the response
            const output = await runCli(args);
            return handleToolResponse(output);
        } catch (error) {
            return handleToolError({ error, message: 'Browser command failed' });
        }
    }
};