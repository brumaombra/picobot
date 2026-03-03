import { logger } from '../../utils/logger.js';
import { getCalendarClient } from '../../utils/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// Calendar get event tool
export const calendarGetEventTool = {
    // Tool definition
    name: 'calendar_get_event',
    description: 'Get detailed information about a specific Google Calendar event by ID.',
    parameters: {
        type: 'object',
        properties: {
            eventId: {
                type: 'string',
                description: 'Event ID.'
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID (default: primary).'
            }
        },
        required: ['eventId']
    },

    // Main execution function
    execute: async args => {
        const { eventId, calendarId = 'primary' } = args;

        // Log get attempt
        logger.debug(`Getting calendar event: ${eventId}`);

        try {
            // Get Calendar client
            const calendar = await getCalendarClient();

            // Get event
            const response = await calendar.events.get({
                calendarId,
                eventId
            });

            // Get the event details from response
            const event = response.data;

            // Return full event details
            return handleToolResponse({
                id: event.id,
                summary: event.summary || '(No title)',
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                location: event.location || '',
                description: event.description || '',
                attendees: event.attendees?.map(attendee => attendee.email) || [],
                htmlLink: event.htmlLink,
                status: event.status,
                created: event.created,
                updated: event.updated
            });
        } catch (error) {
            return handleToolError({ error, message: 'Calendar get failed' });
        }
    }
};