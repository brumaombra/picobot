import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { join } from 'path';
import { logger } from '../../utils/logger.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { BROWSER_MAX_CONTENT_LENGTH, BROWSER_VIEWPORT } from '../../config.js';

/******************************** MCP Client ********************************/

let mcpClient = null;
let mcpTransport = null;

// Resolve the path to the Playwright MCP CLI binary
const MCP_CLI = join(process.cwd(), 'node_modules', '@playwright', 'mcp', 'cli.js');

// Start the Playwright MCP server as a subprocess and connect an MCP client
const ensureClient = async () => {
    if (mcpClient) return mcpClient;
    logger.info('Starting Playwright MCP server');

    // Spawn the MCP server process with headless Chromium, no code generation
    mcpTransport = new StdioClientTransport({
        command: process.execPath,
        args: [
            MCP_CLI,
            '--headless',
            '--codegen=none',
            `--viewport-size=${BROWSER_VIEWPORT.width}x${BROWSER_VIEWPORT.height}`
        ]
    });

    // Connect an MCP client to the server
    mcpClient = new Client({ name: 'picobot', version: '1.0.0' });
    await mcpClient.connect(mcpTransport);
    return mcpClient;
};

// Call a tool on the MCP server and return the text output
const callTool = async (name, args = {}) => {
    const client = await ensureClient();
    const result = await client.callTool({ name, arguments: args });

    // Extract text content from MCP response
    const text = (result.content || [])
        .filter(content => content.type === 'text')
        .map(content => content.text)
        .join('\n');

    // Check for errors
    if (result.isError) {
        throw new Error(text || 'MCP tool call failed');
    }

    // Truncate if needed
    if (text.length > BROWSER_MAX_CONTENT_LENGTH) {
        return text.slice(0, BROWSER_MAX_CONTENT_LENGTH) + '\n… (truncated)';
    }

    // Return the text output
    return text;
};

// Shut down the MCP client and server process
const shutdown = async () => {
    // If the client is still connected, try to close it gracefully
    if (mcpClient) {
        try { await mcpClient.close(); } catch (error) { logger.debug(`MCP client close: ${error.message}`); }
        mcpClient = null;
    }

    // If the transport is still open, try to close it gracefully
    if (mcpTransport) {
        try { await mcpTransport.close(); } catch (error) { logger.debug(`MCP transport close: ${error.message}`); }
        mcpTransport = null;
    }
};

/******************************** Browser Automation Tools ********************************/

// Navigate to a URL and return the accessibility snapshot
export const browserNavigateTool = {
    // Tool definition
    name: 'browser_navigate',
    description: 'Navigate to a URL. Returns accessibility snapshot with element [ref] markers for interaction.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to navigate to.'
            }
        },
        required: ['url']
    },

    // Main execution function
    execute: async ({ url }) => {
        // Create the URL object to validate the URL format
        try { 
            new URL(url); 
        } catch { 
            return handleToolError({ message: 'Invalid URL' }); 
        }
        logger.debug(`browser_navigate: ${url}`);

        try {
            return handleToolResponse(await callTool('browser_navigate', { url }));
        } catch (error) {
            return handleToolError({ error, message: 'Browser navigation failed' });
        }
    }
};

// Get the accessibility snapshot of the current page
export const browserSnapshotTool = {
    // Tool definition
    name: 'browser_snapshot',
    description: 'Get the accessibility snapshot of the current page. Shows interactive elements with [ref] markers.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        try {
            return handleToolResponse(await callTool('browser_snapshot'));
        } catch (error) {
            return handleToolError({ error, message: 'Browser snapshot failed' });
        }
    }
};

// Click an element by its ref from the page snapshot
export const browserClickTool = {
    // Tool definition
    name: 'browser_click',
    description: 'Click an element using its [ref] from the accessibility snapshot. Returns updated snapshot.',
    parameters: {
        type: 'object',
        properties: {
            element: {
                type: 'string',
                description: 'Human-readable element description (e.g. "Submit button").'
            },
            ref: {
                type: 'string',
                description: 'Element ref from the snapshot (e.g. "e42").'
            }
        },
        required: ['element', 'ref']
    },

    // Main execution function
    execute: async ({ element, ref }) => {
        logger.debug(`browser_click: ${ref} (${element})`);
        try {
            return handleToolResponse(await callTool('browser_click', { element, ref }));
        } catch (error) {
            return handleToolError({ error, message: 'Browser click failed' });
        }
    }
};

// Type text into a form field by ref
export const browserTypeTool = {
    // Tool definition
    name: 'browser_type',
    description: 'Type text into a form field identified by its [ref]. Clears existing text first. Returns updated snapshot.',
    parameters: {
        type: 'object',
        properties: {
            element: {
                type: 'string',
                description: 'Human-readable element description (e.g. "Search input").'
            },
            ref: {
                type: 'string',
                description: 'Element ref from the snapshot (e.g. "e42").'
            },
            text: {
                type: 'string',
                description: 'Text to type into the field.'
            },
            submit: {
                type: 'boolean',
                description: 'Press Enter after typing. Default: false.'
            }
        },
        required: ['element', 'ref', 'text']
    },

    // Main execution function
    execute: async ({ element, ref, text, submit = false }) => {
        logger.debug(`browser_type: ${ref} (${element})`);
        try {
            return handleToolResponse(await callTool('browser_type', { element, ref, text, submit }));
        } catch (error) {
            return handleToolError({ error, message: 'Browser type failed' });
        }
    }
};

// Select an option from a dropdown by ref
export const browserSelectOptionTool = {
    // Tool definition
    name: 'browser_select_option',
    description: 'Select an option from a <select> dropdown by its [ref]. Returns updated snapshot.',
    parameters: {
        type: 'object',
        properties: {
            element: {
                type: 'string',
                description: 'Human-readable element description.'
            },
            ref: {
                type: 'string',
                description: 'Element ref from the snapshot.'
            },
            values: {
                type: 'array',
                items: { type: 'string' },
                description: 'Values to select.'
            }
        },
        required: ['element', 'ref', 'values']
    },

    // Main execution function
    execute: async ({ element, ref, values }) => {
        logger.debug(`browser_select_option: ${ref} (${element})`);
        try {
            return handleToolResponse(await callTool('browser_select_option', { element, ref, values }));
        } catch (error) {
            return handleToolError({ error, message: 'Browser select option failed' });
        }
    }
};

// Hover over an element to reveal dropdowns or tooltips
export const browserHoverTool = {
    // Tool definition
    name: 'browser_hover',
    description: 'Hover over an element by its [ref]. Useful for revealing dropdowns or tooltips. Returns updated snapshot.',
    parameters: {
        type: 'object',
        properties: {
            element: {
                type: 'string',
                description: 'Human-readable element description.'
            },
            ref: {
                type: 'string',
                description: 'Element ref from the snapshot.'
            }
        },
        required: ['element', 'ref']
    },

    // Main execution function
    execute: async ({ element, ref }) => {
        logger.debug(`browser_hover: ${ref} (${element})`);
        try {
            return handleToolResponse(await callTool('browser_hover', { element, ref }));
        } catch (error) {
            return handleToolError({ error, message: 'Browser hover failed' });
        }
    }
};

// Scroll the page down
export const browserScrollDownTool = {
    // Tool definition
    name: 'browser_scroll_down',
    description: 'Scroll the page down to reveal more content. Returns updated snapshot.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        logger.debug('browser_scroll_down');
        try {
            return handleToolResponse(await callTool('browser_scroll_down'));
        } catch (error) {
            return handleToolError({ error, message: 'Browser scroll down failed' });
        }
    }
};

// Scroll the page up
export const browserScrollUpTool = {
    // Tool definition
    name: 'browser_scroll_up',
    description: 'Scroll the page up. Returns updated snapshot.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        logger.debug('browser_scroll_up');
        try {
            return handleToolResponse(await callTool('browser_scroll_up'));
        } catch (error) {
            return handleToolError({ error, message: 'Browser scroll up failed' });
        }
    }
};

// Navigate back in browser history
export const browserGoBackTool = {
    // Tool definition
    name: 'browser_go_back',
    description: 'Navigate back in browser history. Returns updated snapshot.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        logger.debug('browser_go_back');
        try {
            return handleToolResponse(await callTool('browser_go_back'));
        } catch (error) {
            return handleToolError({ error, message: 'Browser go back failed' });
        }
    }
};

// Execute JavaScript in the page context
export const browserEvaluateTool = {
    // Tool definition
    name: 'browser_evaluate',
    description: 'Execute JavaScript in the page context. Use function syntax: () => { /* code */ }',
    parameters: {
        type: 'object',
        properties: {
            function: {
                type: 'string',
                description: 'JavaScript function to evaluate, e.g. () => document.title'
            }
        },
        required: ['function']
    },

    // Main execution function
    execute: async args => {
        logger.debug('browser_evaluate');
        try {
            return handleToolResponse(await callTool('browser_evaluate', { function: args.function }));
        } catch (error) {
            return handleToolError({ error, message: 'Browser evaluate failed' });
        }
    }
};

// Wait for a specified number of seconds
export const browserWaitTool = {
    // Tool definition
    name: 'browser_wait',
    description: 'Wait for a specified number of seconds before continuing.',
    parameters: {
        type: 'object',
        properties: {
            time: {
                type: 'number',
                description: 'Time to wait in seconds. Default: 3.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async ({ time = 3 } = {}) => {
        logger.debug(`browser_wait: ${time}s`);
        try {
            return handleToolResponse(await callTool('browser_wait', { time }));
        } catch (error) {
            return handleToolError({ error, message: 'Browser wait failed' });
        }
    }
};

// Manage browser tabs
export const browserTabsTool = {
    // Tool definition
    name: 'browser_tabs',
    description: 'Manage browser tabs. Actions: "list", "select", "close", "new".',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'select', 'close', 'new'],
                description: 'Tab action to perform.'
            },
            index: {
                type: 'number',
                description: 'Tab index for select/close actions.'
            }
        },
        required: ['action']
    },

    // Main execution function
    execute: async ({ action, index }) => {
        logger.debug(`browser_tabs: ${action}`);
        try {
            const args = { action };
            if (index !== undefined) args.index = index;
            return handleToolResponse(await callTool('browser_tabs', args));
        } catch (error) {
            return handleToolError({ error, message: 'Browser tabs failed' });
        }
    }
};

// Close the browser and end the session
export const browserCloseTool = {
    // Tool definition
    name: 'browser_close',
    description: 'Close the browser and end the browsing session.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        logger.debug('browser_close');
        try {
            await callTool('browser_close');
        } catch (error) {
            logger.debug(`browser_close tool: ${error.message}`);
        }

        // Shut down the MCP server process
        await shutdown();
        return handleToolResponse('Browser closed');
    }
};