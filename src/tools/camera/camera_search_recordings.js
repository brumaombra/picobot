import { handleToolError, handleToolResponse, formatReolinkDate, formatReolinkTime, formatTime } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { getCameraClient } from '../../utils/camera-client.js';

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
                description: 'Start of search window as a local datetime string (e.g. "2025-01-15T08:00:00"). Do NOT use UTC (no Z suffix) — the NVR operates in local time.'
            },
            endTime: {
                type: 'string',
                description: 'End of search window as a local datetime string (e.g. "2025-01-15T20:00:00"). Do NOT use UTC (no Z suffix) — the NVR operates in local time.'
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

        try {
            // Get the camera client
            const client = await getCameraClient();

            // Create the payload for the Search API call
            const payload = {
                Search: {
                    channel,
                    onlyStatus: 0,
                    streamType: 'main',
                    StartTime: formatReolinkDate(start),
                    EndTime: formatReolinkDate(end)
                }
            };

            // Execute the search
            const results = await client.api('Search', payload);

            // Parse the file list from the nested SearchResult
            const files = results?.SearchResult?.File ?? [];

            // Format the recordings for the response
            const recordings = files.map(file => {
                // Calculate duration and size for each recording
                const startTimeVideo = file.StartTime;
                const endTimeVideo = file.EndTime;
                const startDateVideo = new Date(startTimeVideo.year, startTimeVideo.mon - 1, startTimeVideo.day, startTimeVideo.hour, startTimeVideo.min, startTimeVideo.sec);
                const endDateVideo = new Date(endTimeVideo.year, endTimeVideo.mon - 1, endTimeVideo.day, endTimeVideo.hour, endTimeVideo.min, endTimeVideo.sec);
                const durationSec = (endDateVideo - startDateVideo) / 1000;
                const sizeMB = (parseInt(file.size, 10) / 1024 / 1024).toFixed(1);

                // Return the formatted recording info
                return {
                    start: formatReolinkTime(startTimeVideo),
                    end: formatReolinkTime(endTimeVideo),
                    duration: formatTime(durationSec * 1000),
                    size: `${sizeMB} MB`,
                    type: file.type
                };
            });

            // Return the search results
            return handleToolResponse({
                channel,
                searchFrom: startTime,
                searchTo: endTime,
                count: recordings.length,
                recordings
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to search recordings' });
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