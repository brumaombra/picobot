import { logger } from '../../../src/utils/common/logger.js';
import { getCalendarClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Calendar list events tool
const calendarListEventsTool = {
    // Tool definition
    name: 'calendar_list_events',
    description: 'List Google Calendar events in date range with essential metadata. Use calendar_get_event to get full details.',
    parameters: {
        type: 'object',
        properties: {
            startDate: {
                type: 'string',
                description: 'Start date (ISO 8601 format).'
            },
            endDate: {
                type: 'string',
                description: 'End date (ISO 8601 format).'
            },
            maxResults: {
                type: 'number',
                description: 'Max events (default: 10).'
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID (default: primary).'
            }
        },
        required: ['startDate', 'endDate']
    },

    // Main execution function
    execute: async args => {
        const { startDate, endDate, maxResults = 10, calendarId = 'primary' } = args;

        // Log list attempt
        logger.debug(`Listing calendar events: ${startDate} to ${endDate}`);

        try {
            // Get Calendar client
            const calendar = await getCalendarClient();

            // List events
            const response = await calendar.events.list({
                calendarId,
                timeMin: new Date(startDate).toISOString(),
                timeMax: new Date(endDate).toISOString(),
                maxResults: Math.min(maxResults, 100),
                singleEvents: true,
                orderBy: 'startTime'
            });

            // Check if any events found
            if (!response.data.items || response.data.items.length === 0) {
                return handleToolResponse('No events found in the specified date range.');
            }

            // Format output with essential metadata only
            const events = response.data.items.map(event => ({
                id: event.id,
                summary: event.summary || '(No title)',
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                location: event.location || ''
            }));

            // Return events
            return handleToolResponse(events);
        } catch (error) {
            return handleToolError({ error, message: 'Calendar list failed' });
        }
    }
};

// Export the tool as the default export of this module
export default calendarListEventsTool;