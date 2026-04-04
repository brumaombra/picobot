import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { logger } from 'squadforge';
import { setCameraLightMode } from '../../../src/utils/camera/camera-client.js';

// Camera light control tool
export default {
    // Tool definition
    name: 'camera_set_light',
    description: 'Turn a camera white light / spotlight on, off, or auto mode when supported by the device.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            },
            mode: {
                type: 'string',
                description: 'Desired light mode: on, off, or auto. Default is on.',
                enum: ['on', 'off', 'auto']
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const channel = args.channel ?? 0;
        const mode = args.mode ?? 'on';

        // Log the action
        logger.debug(`Camera: setting light on channel ${channel} to ${mode}`);

        try {
            // Send the light control request via the shared camera helper
            const result = await setCameraLightMode({ channel, mode });

            // Return the outcome and raw device response for diagnostics
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to set camera light mode' });
        }
    }
};