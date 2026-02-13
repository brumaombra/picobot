import * as os from 'os';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// System information tools
export const systemInfoBasicTool = {
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

// CPU information tool
export const systemInfoCpuTool = {
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

// Memory information tool
export const systemInfoMemoryTool = {
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

// All-in-one system information tool
export const systemInfoAllTool = {
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