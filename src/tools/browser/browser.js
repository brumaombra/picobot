import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { BROWSER_DEFAULT_TIMEOUT_MS, BROWSER_MAX_CONTENT_LENGTH } from '../../config.js';

const execFileAsync = promisify(execFile);

/******************************** Playwright CLI Runner ********************************/

// Resolve the playwright-cli entry point from local node_modules
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_SCRIPT = join(__dirname, '..', '..', '..', 'node_modules', '@playwright', 'cli', 'playwright-cli.js');

// Run a playwright-cli command and return its stdout
const runCli = async (args, timeoutMs = BROWSER_DEFAULT_TIMEOUT_MS) => {
    logger.debug(`playwright-cli ${args.join(' ')}`);
    try {
        const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_SCRIPT, ...args], {
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024
        });

        // Combine output
        let output = (stdout || '').trim();
        if (stderr?.trim()) {
            output += (output ? '\n' : '') + stderr.trim();
        }

        // Truncate if needed
        if (output.length > BROWSER_MAX_CONTENT_LENGTH) {
            output = output.slice(0, BROWSER_MAX_CONTENT_LENGTH) + '\n… (truncated)';
        }

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

        current += ch;
    }

    if (current) args.push(current);
    return args;
};

/******************************** Single Browser Tool ********************************/

export const browserTool = {
    name: 'browser',
    description: `Run a Playwright CLI command for browser automation. Token-efficient: one tool replaces many.

Commands (pass as the "command" string):
  open [url] [--headed]     Navigate/open browser (optionally to a URL)
  goto <url>                Navigate to a URL
  snapshot                  Get page accessibility snapshot with element [ref] markers
  click <ref>               Click an element by ref
  type <text>               Type text into focused/editable element
  fill <ref> <text>         Fill a field by ref
  press <key>               Press a key (Enter, Tab, Escape, etc.)
  hover <ref>               Hover over an element
  select <ref> <value>      Select dropdown option
  check <ref>               Check a checkbox
  uncheck <ref>             Uncheck a checkbox
  screenshot [ref]          Take a screenshot (full page or element)
  eval <js>                 Evaluate JavaScript on page
  go-back / go-forward      Browser history navigation
  reload                    Reload the page
  close                     Close the page
  tab-list / tab-new [url] / tab-select <i> / tab-close [i]   Tab management
  console [level]           Get console messages
  network                   List network requests

Examples:
  "open https://example.com"
  "snapshot"
  "click e42"
  "fill e15 Hello world"
  "press Enter"
  "screenshot"`,
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

    execute: async ({ command }) => {
        if (!command?.trim()) {
            return handleToolError({ message: 'No command provided. Try "open https://example.com" or "snapshot".' });
        }

        const args = parseCommand(command.trim());
        logger.debug(`browser tool: ${command}`);

        try {
            const output = await runCli(args);
            return handleToolResponse(output);
        } catch (error) {
            return handleToolError({ error, message: 'Browser command failed' });
        }
    }
};