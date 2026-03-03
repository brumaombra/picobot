import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { createCameraClient } from '../../utils/camera-client.js';

export const cameraMotionStateTool = {
    // Tool definition
    name: 'camera_motion_state',
    description: 'Check the current motion detection state for a camera channel.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const channel = args.channel ?? 0;

        // Log the action
        logger.debug(`Camera: getting motion state for channel ${channel}`);

        // Create the camera client
        const client = await createCameraClient();

        try {
            // Fetch the motion detection state
            const state = await client.api('GetMdState', { channel, action: 0 });

            // Return the motion detection state
            return handleToolResponse({ channel, motionState: state });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get motion detection state' });
        } finally {
            await client.close();
        }
    }
};