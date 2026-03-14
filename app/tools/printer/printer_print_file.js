import { existsSync } from 'fs';
import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Printer file print tool
export const printerPrintFileTool = {
    // Tool definition
    name: 'printer_print_file',
    description: 'Print a local file to a selected printer.',
    parameters: {
        type: 'object',
        properties: {
            printerName: {
                type: 'string',
                description: 'Printer name as configured on the current machine.'
            },
            filePath: {
                type: 'string',
                description: 'Absolute local path to the file to print.'
            }
        },
        required: ['printerName', 'filePath']
    },

    // Main execution function
    execute: async args => {
        const { printerName, filePath } = args;

        try {
            // Validate file path exists before attempting print
            if (!existsSync(filePath)) {
                return handleToolError({ message: `File not found: ${filePath}` });
            }

            // Escape values for command building
            const safePrinterName = String(printerName).replace(/'/g, "''");
            const safeFilePath = String(filePath).replace(/'/g, "''");

            // Use platform-specific print commands
            let commandSpec;
            if (process.platform === 'win32') {
                commandSpec = {
                    command: 'powershell',
                    args: [
                        '-NoProfile',
                        '-Command',
                        `$file='${safeFilePath}'; $printer='${safePrinterName}'; Start-Process -FilePath $file -Verb PrintTo -ArgumentList ('"' + $printer + '"') -WindowStyle Hidden; Write-Output 'Print command sent.'`
                    ]
                };
            } else if (process.platform === 'linux') {
                commandSpec = {
                    command: 'lp',
                    args: ['-d', printerName, filePath]
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
                return handleToolError({ message: `Print file failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Print file failed' });
        }
    }
};