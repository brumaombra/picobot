import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { withCameraClient } from '../../utils/camera-client.js';

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
            },
            streamType: {
                type: 'string',
                enum: ['main', 'sub'],
                description: 'Stream type to search. Default is "main".'
            }
        },
        required: ['startTime', 'endTime']
    },

    // Main execution function
    execute: async args => {
        const { channel = 0, startTime, endTime, streamType = 'main' } = args;

        // Log the action
        logger.debug(`Camera: searching recordings on channel ${channel} from ${startTime} to ${endTime}`);

        try {
            return await withCameraClient(async client => {
                // Parse the time range
                const start = new Date(startTime);
                const end = new Date(endTime);

                // Build the search payload
                const payload = {
                    channel,
                    streamType,
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
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to search recordings' });
        }
    }
};