import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Printer discovery/list tool
export const printerListTool = {
    // Tool definition
    name: 'printer_list',
    description: 'List available printers on the current machine.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Use platform-specific printer listing commands
            let commandSpec;
            if (process.platform === 'win32') {
                commandSpec = {
                    command: 'powershell',
                    args: ['-NoProfile', '-Command', 'Get-Printer | Select-Object Name,PrinterStatus,Type,PortName | Format-Table -AutoSize']
                };
            } else if (process.platform === 'linux') {
                commandSpec = {
                    command: 'lpstat',
                    args: ['-p', '-d']
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
                return handleToolError({ message: `Printer list failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Printer list failed' });
        }
    }
};