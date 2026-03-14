import * as os from 'os';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// All-in-one system information tool
const systemInfoAllTool = {
    // Tool definition
    name: 'system_info_all',
    description: 'Get complete system information.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Get all system information
            const result = {
                basic: {
                    platform: os.platform(),
                    architecture: os.arch(),
                    hostname: os.hostname(),
                    type: os.type(),
                    release: os.release(),
                    uptime: Math.round(os.uptime() / 3600) + ' hours',
                    nodeVersion: process.version
                },
                cpu: {
                    cores: os.cpus().length,
                    model: os.cpus()[0].model,
                    speed: os.cpus()[0].speed + ' MHz',
                    loadAverage: os.loadavg()
                },
                memory: {
                    total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
                    free: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
                    used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024) + ' GB'
                }
            };

            // Return the system information
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'System info retrieval failed' });
        }
    }
};

// Export the tool as the default export of this module
export default systemInfoAllTool;