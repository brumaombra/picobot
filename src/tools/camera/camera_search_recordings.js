import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { createCameraClient } from '../../utils/camera-client.js';

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
                description: 'Start of search window as an ISO 8601 datetime string (e.g. "2025-01-15T08:00:00Z").'
            },
            endTime: {
                type: 'string',
                description: 'End of search window as an ISO 8601 datetime string (e.g. "2025-01-15T20:00:00Z").'
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
        const validation = validateInputDates({ startTime, endTime });
        if (!validation.success) {
            return handleToolError({ message: validation.message });
        }

        // Get the validated dates
        const { start, end } = validation;

        // Create the camera client
        const client = await createCameraClient();

        try {
            // Build the search payload
            const payload = {
                channel,
                streamType: 'main',
                StartTime: {
                    year: start.getUTCFullYear(),
                    mon: start.getUTCMonth() + 1,
                    day: start.getUTCDate(),
                    hour: start.getUTCHours(),
                    min: start.getUTCMinutes(),
                    sec: start.getUTCSeconds()
                },
                EndTime: {
                    year: end.getUTCFullYear(),
                    mon: end.getUTCMonth() + 1,
                    day: end.getUTCDate(),
                    hour: end.getUTCHours(),
                    min: end.getUTCMinutes(),
                    sec: end.getUTCSeconds()
                }
            };

            // Execute the search
            const results = await client.api('Search', payload);

            // Return the recordings list
            return handleToolResponse({ channel, startTime, endTime, recordings: results });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to search recordings' });
        } finally {
            await client.close();
        }
    }
};

// Validate the input dates
const validateInputDates = ({ startTime, endTime }) => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate the start time
    if (isNaN(start.getTime())) {
        return { success: false, message: `Invalid startTime: "${startTime}". Must be a valid ISO 8601 datetime string.` }
    }

    // Validate the end time
    if (isNaN(end.getTime())) {
        return { success: false, message: `Invalid endTime: "${endTime}". Must be a valid ISO 8601 datetime string.` }
    }

    // Ensure start time is before end time
    if (start >= end) {
        return { success: false, message: 'startTime must be before endTime.' };
    }

    // Return the validated dates
    return {
        success: true,
        start,
        end
    };
};