import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Printer status/details tool
export const printerStatusTool = {
    // Tool definition
    name: 'printer_status',
    description: 'Get detailed status for one printer.',
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

            // Use platform-specific status commands
            let commandSpec;
            if (process.platform === 'win32') {
                commandSpec = {
                    command: 'powershell',
                    args: ['-NoProfile', '-Command', `Get-Printer -Name "${safePrinterName}" | Format-List *`]
                };
            } else if (process.platform === 'linux') {
                commandSpec = {
                    command: 'lpstat',
                    args: ['-l', '-p', safePrinterName]
                };
            } else {
                return handleToolError({ message: `Unsupported platform: ${process.platform}` });
            }

            // Run command and return raw output
            const result = await executeCommand({
                command: commandSpec.command,
                args: commandSpec.args,
                timeoutMs: 20000
            });

            // Return execution error when process start fails
            if (result.error) {
                return handleToolError({ message: `Printer status failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Printer status failed' });
        }
    }
};