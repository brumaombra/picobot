import * as os from 'os';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// System information tool
export default {
    // Tool definition
    name: 'system_info_basic',
    description: 'Get basic system information.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Create the result object
            const result = {
                platform: os.platform(),
                architecture: os.arch(),
                hostname: os.hostname(),
                type: os.type(),
                release: os.release(),
                uptime: Math.round(os.uptime() / 3600) + ' hours',
                nodeVersion: process.version
            };

            // Return the system information
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'System info retrieval failed' });
        }
    }
};