import * as os from 'os';

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
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: `System info retrieval failed: ${error.message}`
            };
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
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: `System info retrieval failed: ${error.message}`
            };
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
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: `System info retrieval failed: ${error.message}`
            };
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
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: `System info retrieval failed: ${error.message}`
            };
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
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: `System info retrieval failed: ${error.message}`
            };
        }
    }
};

// Date and time tool
export const systemDateTimeTool = {
    // Tool definition
    name: 'system_datetime',
    description: 'Get the current date and time in various formats.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Get current date and time
            const now = new Date();

            // Create the result object with various formats
            const result = {
                timestamp: now.getTime(),
                iso: now.toISOString(),
                utc: now.toUTCString(),
                local: now.toLocaleString(),
                date: now.toLocaleDateString(),
                time: now.toLocaleTimeString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                timezoneOffset: now.getTimezoneOffset()
            };

            // Return the date/time information
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: `Date/time retrieval failed: ${error.message}`
            };
        }
    }
};