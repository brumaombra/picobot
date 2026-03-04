import { join } from 'path';
import { writeFileSync } from 'fs';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { WORKSPACE_DIR } from '../../config.js';
import { createCameraClient } from '../../utils/camera-client.js';

export const cameraSnapshotTool = {
    // Tool definition
    name: 'camera_snapshot',
    description: 'Capture a snapshot (JPEG image) from a camera channel. Saves it to the workspace and returns the file path.',
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
        logger.debug(`Camera: taking snapshot on channel ${channel}`);

        // Create the camera client
        const client = await createCameraClient();

        try {
            // Capture the snapshot as a buffer
            const buffer = await client.snapshotToBuffer(channel);

            // Save the snapshot to the workspace
            const filename = `snapshot_ch${channel}_${Date.now()}.jpg`;
            const filePath = join(WORKSPACE_DIR, filename);
            writeFileSync(filePath, buffer);
            logger.debug(`Camera: snapshot saved to ${filePath}`);

            // Return the file path for the agent to send
            return handleToolResponse({ filePath, filename, channel });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to capture snapshot' });
        } finally {
            await client.close();
        }
    }
};