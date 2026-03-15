import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Network traceroute tool
export default {
    // Tool definition
    name: 'network_traceroute',
    description: 'Trace network hops to a destination host.',
    parameters: {
        type: 'object',
        properties: {
            host: {
                type: 'string',
                description: 'Hostname or IP address to trace.'
            }
        },
        required: ['host']
    },

    // Main execution function
    execute: async args => {
        const { host } = args;

        try {
            // Normalize and validate inputs
            const normalizedHost = String(host || '').trim();
            const command = process.platform === 'win32' ? 'tracert' : 'traceroute';
            const commandArgs = process.platform === 'win32' ? ['-d', normalizedHost] : ['-n', normalizedHost];

            // Run traceroute and return raw output for LLM interpretation
            const trace = await executeCommand({ command, args: commandArgs, timeoutMs: 60000 });

            // Check for errors in execution and return appropriate responses
            if (trace.error) {
                return handleToolError({ message: `Traceroute failed: ${trace.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: trace.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Traceroute failed' });
        }
    }
};