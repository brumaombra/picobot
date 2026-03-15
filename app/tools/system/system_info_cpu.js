import * as os from 'os';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// CPU information tool
export default {
    // Tool definition
    name: 'system_info_cpu',
    description: 'Get CPU information.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Get CPU information
            const cpus = os.cpus();

            // Create the result object
            const result = {
                cores: cpus.length,
                model: cpus[0].model,
                speed: cpus[0].speed + ' MHz',
                loadAverage: os.loadavg()
            };

            // Return the system information
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'System info retrieval failed' });
        }
    }
};