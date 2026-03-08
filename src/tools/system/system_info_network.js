import * as os from 'os';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Network information tool
export const systemInfoNetworkTool = {
    // Tool definition
    name: 'system_info_network',
    description: 'Get network interface information.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Get the network interfaces
            const interfaces = os.networkInterfaces();

            // Create the result object
            const result = {};
            for (const [name, addresses] of Object.entries(interfaces)) {
                result[name] = addresses
                    .filter(addr => addr.family === 'IPv4' && !addr.internal)
                    .map(addr => addr.address);
            }

            // Return the system information
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'System info retrieval failed' });
        }
    }
};