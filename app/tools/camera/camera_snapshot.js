import { join } from 'path';
import { mkdirSync } from 'fs';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { logger } from '../../../src/utils/common/logger.js';
import { WORKSPACE_DIR } from '../../../src/config.js';
import { captureSnapshotToPath } from '../../../src/utils/camera/camera-client.js';

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
            // Create the file path
            const filename = `snapshot_ch${channel}_${Date.now()}.jpg`;
            const cameraDir = join(WORKSPACE_DIR, 'camera');
            mkdirSync(cameraDir, { recursive: true });
            const filePath = join(cameraDir, filename);

            // Capture the snapshot and save to the file path
            await captureSnapshotToPath({ channel, outputPath: filePath });
            logger.debug(`Camera: snapshot saved to ${filePath}`);

            // Return the file path for the agent to send
            return handleToolResponse({
                filePath,
                filename,
                channel
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to capture snapshot' });
        }
    }
};