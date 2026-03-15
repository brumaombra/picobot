import { mkdirSync } from 'fs';
import { join } from 'path';
import { handleToolError, handleToolResponse, validateCameraInputDates } from '../../../src/utils/common/utils.js';
import { logger } from '../../../squadforge/src/index.js';
import { WORKSPACE_DIR } from '../../../src/config.js';
import { downloadNvrRecordingToPath } from '../../../src/utils/camera/camera-client.js';

// Camera recording download tool
export default {
    // Tool definition
    name: 'camera_download_recording',
    description: 'Download a specific NVR recording to a local file. Returns the saved file path.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel (0-based). Default 0.'
            },
            startTime: {
                type: 'string',
                description: 'Start local datetime, format: "YYYY-MM-DDTHH:mm:ss" (no Z).'
            },
            endTime: {
                type: 'string',
                description: 'End local datetime, format: "YYYY-MM-DDTHH:mm:ss" (no Z).'
            }
        },
        required: ['startTime', 'endTime']
    },

    // Main execution function
    execute: async args => {
        const { channel = 0, startTime, endTime } = args;

        // Log the action
        logger.debug(`Camera: downloading recording on channel ${channel} from ${startTime} to ${endTime}`);

        // Validate and parse the time range
        const validation = validateCameraInputDates({ startTime, endTime });
        if (!validation.success) {
            return handleToolError({ message: validation.message });
        }

        try {
            // Build a clean local output path using the recording timestamps
            const filenameStamp = String(startTime).replace(/[^0-9]/g, '').slice(0, 14) || Date.now();
            const outputName = `ch${channel}_${filenameStamp}.mp4`;
            const cameraDir = join(WORKSPACE_DIR, 'camera');
            mkdirSync(cameraDir, { recursive: true });
            const outputPath = join(cameraDir, outputName);

            // Prepare and download the NVR recording in one helper call
            const { nvrFileName, downloadTime } = await downloadNvrRecordingToPath({
                channel,
                startTime,
                endTime,
                iLogicChannel: 0,
                outputName,
                outputPath
            });

            // Log the saved file
            logger.debug(`Camera: recording saved to ${outputPath}`);

            // Return the file path and some debug info for the agent to send
            return handleToolResponse({
                outputPath,
                nvrFileName,
                downloadTime
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to download recording' });
        }
    }
};