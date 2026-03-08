import findLocalDevices from 'local-devices';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Network discovery tool powered by local-devices
export const networkListDevicesTool = {
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
            // Use local-devices to find devices on the local network
            const devices = await findLocalDevices();

            // Return the list of devices (IP, MAC, name) for the agent to use
            return handleToolResponse(devices || 'No devices found');
        } catch (error) {
            return handleToolError({ error, message: 'Failed to list network devices' });
        }
    }
};