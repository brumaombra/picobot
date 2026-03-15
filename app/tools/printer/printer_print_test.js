import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Printer test-page tool
export default {
    // Tool definition
    name: 'printer_print_test',
    description: 'Send a printer test page command to one printer.',
    parameters: {
        type: 'object',
        properties: {
            printerName: {
                type: 'string',
                description: 'Printer name as configured on the current machine.'
            }
        },
        required: ['printerName']
    },

    // Main execution function
    execute: async args => {
        const { printerName } = args;

        try {
            // Escape double quotes for PowerShell/CUPS commands
            const safePrinterName = String(printerName).replace(/"/g, '""');

            // Use platform-specific test page commands
            let commandSpec;
            if (process.platform === 'win32') {
                commandSpec = {
                    command: 'rundll32',
                    args: ['printui.dll,PrintUIEntry', '/k', '/n', safePrinterName]
                };
            } else if (process.platform === 'linux') {
                commandSpec = {
                    command: 'lp',
                    args: ['-d', safePrinterName, '/usr/share/cups/data/testprint']
                };
            } else {
                return handleToolError({ message: `Unsupported platform: ${process.platform}` });
            }

            // Run command and return raw output
            const result = await executeCommand({
                command: commandSpec.command,
                args: commandSpec.args,
                timeoutMs: 30000
            });

            // Return execution error when process start fails
            if (result.error) {
                return handleToolError({ message: `Printer test print failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Printer test print failed' });
        }
    }
};