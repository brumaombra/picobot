import { executeCommand, handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Network local IP tool
export const networkLocalIpTool = {
    // Tool definition
    name: 'network_local_ip',
    description: 'Show the local machine IP configuration.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Determine the appropriate command based on the platform
            const command = process.platform === 'win32' ? 'ipconfig' : 'ip';
            const commandArgs = process.platform === 'win32' ? [] : ['addr'];

            // Run local IP command and return raw output
            const result = await executeCommand({
                command,
                args: commandArgs,
                timeoutMs: 15000
            });

            // Check for errors in execution and return appropriate responses
            if (result.error) {
                return handleToolError({ message: `Failed to read local IP: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to read local IP' });
        }
    }
};