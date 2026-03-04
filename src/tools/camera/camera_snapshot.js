import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { WORKSPACE_DIR } from '../../config.js';
import { getCameraClient } from '../../utils/camera-client.js';

// Camera snapshot tool
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

        try {
            // Get the camera client
            const client = await getCameraClient();

            // Capture the snapshot as a buffer
            const buffer = await client.snapshotToBuffer(channel);

            // Save the snapshot to the camera folder in the workspace
            const filename = `snapshot_ch${channel}_${Date.now()}.jpg`;
            const cameraDir = join(WORKSPACE_DIR, 'camera');
            mkdirSync(cameraDir, { recursive: true });
            const filePath = join(cameraDir, filename);
            writeFileSync(filePath, buffer);
            logger.debug(`Camera: snapshot saved to ${filePath}`);

            // Return the file path for the agent to send
            return handleToolResponse({ filePath, filename, channel });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to capture snapshot' });
        }
    }
};