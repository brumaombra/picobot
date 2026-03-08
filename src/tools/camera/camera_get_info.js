import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { getNvrDeviceInfo } from '../../utils/camera/camera-client.js';

// Camera information retrieval tool
export const cameraGetInfoTool = {
    // Tool definition
    name: 'camera_get_info',
    description: 'Get NVR device information and the list of connected camera channels.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        // Log the action
        logger.debug('Camera: fetching device info');

        try {
            // Fetch device info and channel status via shared helper
            const { device, channels } = await getNvrDeviceInfo();

            // Return device and channel information
            return handleToolResponse({
                device,
                channels
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get NVR device info' });
        }
    }
};