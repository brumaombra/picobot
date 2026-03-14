import * as os from 'os';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Memory information tool
const systemInfoMemoryTool = {
    // Tool definition
    name: 'system_info_memory',
    description: 'Get memory information.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Create the result object
            const result = {
                total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
                free: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
                used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024) + ' GB'
            };

            // Return the system information
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'System info retrieval failed' });
        }
    }
};

// Export the tool as the default export of this module
export default systemInfoMemoryTool;