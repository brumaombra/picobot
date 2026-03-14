import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { logger } from '../../../squadforge/src/index.js';
import { getNvrDeviceInfo } from '../../../src/utils/camera/camera-client.js';

// Camera information retrieval tool
const cameraGetInfoTool = {
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

// Export the tool as the default export of this module
export default cameraGetInfoTool;