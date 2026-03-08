import { executeCommand, handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Network TCP port check tool
export const networkPortCheckTool = {
    // Tool definition
    name: 'network_port_check',
    description: 'Check whether a TCP port is open on a host.',
    parameters: {
        type: 'object',
        properties: {
            host: {
                type: 'string',
                description: 'Hostname or IP address to test.'
            },
            port: {
                type: 'number',
                description: 'TCP port to test.'
            }
        },
        required: ['host', 'port']
    },

    // Main execution function
    execute: async args => {
        const { host, port } = args;

        try {
            // Normalize and validate inputs
            const normalizedHost = String(host || '').trim();
            const normalizedPort = Number.isFinite(port) ? Math.floor(port) : NaN;

            // Validate host and port inputs
            if (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
                return handleToolError({ message: 'port must be an integer between 1 and 65535.' });
            }

            // Use platform-specific commands to check TCP port connectivity
            let commandSpec;
            if (process.platform === 'win32') {
                commandSpec = {
                    command: 'powershell',
                    args: [
                        '-NoProfile',
                        '-Command',
                        `Test-NetConnection -ComputerName \"${normalizedHost}\" -Port ${normalizedPort} | Format-List -Property ComputerName,RemotePort,TcpTestSucceeded`
                    ]
                };
            } else {
                commandSpec = {
                    command: 'nc',
                    args: ['-vz', '-w', '5', normalizedHost, String(normalizedPort)]
                };
            }

            // Run native port-check command
            const result = await executeCommand({
                command: commandSpec.command,
                args: commandSpec.args,
                timeoutMs: 10000
            });

            // Check for errors in execution and return appropriate responses
            if (result.error) {
                return handleToolError({ message: `TCP port check failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'TCP port check failed' });
        }
    }
};