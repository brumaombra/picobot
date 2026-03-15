import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Network ping diagnostic tool
export default {
    // Tool definition
    name: 'network_ping',
    description: 'Ping a host to test network reachability and latency.',
    parameters: {
        type: 'object',
        properties: {
            host: {
                type: 'string',
                description: 'Hostname or IP address to ping.'
            }
        },
        required: ['host']
    },

    // Main execution function
    execute: async args => {
        const { host } = args;
        const pingCount = 4;

        try {
            // Normalize and validate inputs
            const command = 'ping';
            const commandArgs = process.platform === 'win32' ? ['-n', String(pingCount), host] : ['-c', String(pingCount), host];

            // Run ping and return raw command output for LLM interpretation
            const result = await executeCommand({
                command,
                args: commandArgs,
                timeoutMs: 15000
            });

            // Check for errors in execution and return appropriate responses
            if (result.error) {
                return handleToolError({ message: `Network ping failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Network ping failed' });
        }
    }
};