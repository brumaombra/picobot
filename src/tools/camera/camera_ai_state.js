import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { createCameraClient } from '../../utils/camera-client.js';

// Camera AI detection state tool
export const cameraAiStateTool = {
    // Tool definition
    name: 'camera_ai_state',
    description: 'Get the current AI detection state for a camera channel. Shows whether persons, vehicles, or pets have been detected.',
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
        logger.debug(`Camera: getting AI state for channel ${channel}`);

        // Create the camera client
        const client = await createCameraClient();

        try {
            // Fetch the AI detection state
            const state = await client.api('GetAiState', { channel, action: 0 });

            // Return the AI detection state
            return handleToolResponse({ channel, aiState: state });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get AI detection state' });
        } finally {
            await client.close();
        }
    }
};