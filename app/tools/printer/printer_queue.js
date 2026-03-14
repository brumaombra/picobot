import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Printer queue/jobs tool
const printerQueueTool = {
    // Tool definition
    name: 'printer_queue',
    description: 'Get queued print jobs for one printer.',
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

            // Use platform-specific queue commands
            let commandSpec;
            if (process.platform === 'win32') {
                commandSpec = {
                    command: 'powershell',
                    args: ['-NoProfile', '-Command', `Get-PrintJob -PrinterName "${safePrinterName}" | Format-Table -AutoSize`]
                };
            } else if (process.platform === 'linux') {
                commandSpec = {
                    command: 'lpstat',
                    args: ['-o', safePrinterName]
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
                return handleToolError({ message: `Printer queue check failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Printer queue check failed' });
        }
    }
};

// Export the tool as the default export of this module
export default printerQueueTool;