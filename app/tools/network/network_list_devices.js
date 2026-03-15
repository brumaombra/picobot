import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Network discovery tool
export default {
    // Tool definition
    name: 'network_list_devices',
    description: 'List all network devices discovered in the local network.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Use a single common command path and return raw output
            const result = await executeCommand({
                command: 'arp',
                args: ['-a'],
                timeoutMs: 15000
            });

            // Check for errors in execution and return appropriate responses
            if (result.error) {
                return handleToolError({ message: `Failed to list network devices: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to list network devices' });
        }
    }
};