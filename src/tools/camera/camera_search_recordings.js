import { handleToolError, handleToolResponse, validateCameraInputDates } from '../../utils/common/utils.js';
import { logger } from '../../utils/common/logger.js';
import { searchNvrRecordings } from '../../utils/camera/camera-client.js';

// Camera recording search tool
export const cameraSearchRecordingsTool = {
    // Tool definition
    name: 'camera_search_recordings',
    description: 'Search for recorded footage on the NVR within a date/time range for a specific channel.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
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
        logger.debug(`Camera: searching recordings on channel ${channel} from ${startTime} to ${endTime}`);

        // Validate and parse the time range
        const validation = validateCameraInputDates({ startTime, endTime });
        if (!validation.success) {
            return handleToolError({ message: validation.message });
        }

        try {
            // Execute the search using the shared NVR helper
            const { recordings, count } = await searchNvrRecordings({
                channel,
                startTime,
                endTime,
                onlyStatus: 0
            });

            // Return the search results
            return handleToolResponse({
                channel,
                searchFrom: startTime,
                searchTo: endTime,
                count,
                recordings
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to search recordings' });
        }
    }
};