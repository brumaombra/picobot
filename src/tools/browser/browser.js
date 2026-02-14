import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { BROWSER_DEFAULT_TIMEOUT_MS, BROWSER_MAX_CONTENT_LENGTH } from '../../config.js';

// Promisified version of execFile for async/await usage
const execFileAsync = promisify(execFile);

/******************************** Available Commands ********************************/

// List of supported browser commands
const BROWSER_COMMANDS = [
    { name: 'open', description: 'Navigate/open browser (optionally to a URL). Usage: open [url] [--headed]' },
    { name: 'goto', description: 'Navigate to a URL. Usage: goto <url>' },
    { name: 'snapshot', description: 'Get page accessibility snapshot with element [ref] markers.' },
    { name: 'click', description: 'Click an element by ref. Usage: click <ref>' },
    { name: 'type', description: 'Type text into the focused/editable element. Usage: type <text>' },
    { name: 'fill', description: 'Fill a field by ref. Usage: fill <ref> <text>' },
    { name: 'press', description: 'Press a key (Enter, Tab, Escape, etc.). Usage: press <key>' },
    { name: 'hover', description: 'Hover over an element. Usage: hover <ref>' },
    { name: 'select', description: 'Select a dropdown option. Usage: select <ref> <value>' },
    { name: 'check', description: 'Check a checkbox. Usage: check <ref>' },
    { name: 'uncheck', description: 'Uncheck a checkbox. Usage: uncheck <ref>' },
    { name: 'screenshot', description: 'Take a screenshot (full page or element). Usage: screenshot [ref]' },
    { name: 'eval', description: 'Evaluate JavaScript on the page. Usage: eval <js>' },
    { name: 'go-back', description: 'Navigate back in browser history.' },
    { name: 'go-forward', description: 'Navigate forward in browser history.' },
    { name: 'reload', description: 'Reload the current page.' },
    { name: 'close', description: 'Close the current page.' },
    { name: 'tab-list', description: 'List all open tabs.' },
    { name: 'tab-new', description: 'Open a new tab. Usage: tab-new [url]' },
    { name: 'tab-select', description: 'Switch to a tab by index. Usage: tab-select <i>' },
    { name: 'tab-close', description: 'Close a tab by index. Usage: tab-close [i]' },
    { name: 'console', description: 'Get console messages. Usage: console [level]' },
    { name: 'network', description: 'List network requests.' }
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

/******************************** Playwright CLI Runner ********************************/

// Run a playwright-cli command via npx and return its stdout
const runCli = async (args, timeoutMs = BROWSER_DEFAULT_TIMEOUT_MS) => {
    logger.debug(`npx playwright-cli ${args.join(' ')}`);

    try {
        // Execute the command
        const { stdout } = await execFileAsync('npx', ['playwright-cli', ...args], {
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024,
            shell: true
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
    description: 'Run a Playwright CLI command for browser automation. Pass a valid command name with its arguments.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Playwright CLI command (without the "playwright-cli" prefix).'
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
            const output = await runCli(args);
            return handleToolResponse(output);
        } catch (error) {
            return handleToolError({ error, message: 'Browser command failed' });
        }
    }
};