import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { logger } from 'squadforge';
import { setCameraLightState } from '../../../src/utils/camera/camera-client.js';

// Camera light control tool
export default {
    // Tool definition
    name: 'camera_set_light',
    description: 'Turn a camera spotlight on or off.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based).'
            },
            state: {
                type: 'string',
                description: 'Desired light state: on or off. Default is on.',
                enum: ['on', 'off']
            }
        },
        required: ['channel']
    },

    // Main execution function
    execute: async args => {
        const channel = args.channel;
        const state = args.state ?? 'on';

        // Log the action
        logger.debug(`Camera: setting light on channel ${channel} to ${state}`);

        try {
            // Send the light control request via the shared camera helper
            const result = await setCameraLightState({ channel, state });

            // Return the outcome and raw device response for diagnostics
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to set camera light state' });
        }
    }
};