import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { createCameraClient } from '../../utils/camera-client.js';

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

        // Create the camera client
        const client = await createCameraClient();

        try {
            // Fetch device info and channel status
            const devInfo = await client.api('GetDevInfo', {});
            const channelInfo = await client.api('GetChannelstatus', {}).catch(() => null);

            // Return device and channel information
            return handleToolResponse({ device: devInfo, channels: channelInfo });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get NVR device info' });
        } finally {
            await client.close();
        }
    }
};