import { logger } from '../../utils/common/logger.js';
import { getCalendarClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Calendar update event tool
export const calendarUpdateEventTool = {
    // Tool definition
    name: 'calendar_update_event',
    description: 'Update Google Calendar event details.',
    parameters: {
        type: 'object',
        properties: {
            eventId: {
                type: 'string',
                description: 'Event ID to update.'
            },
            summary: {
                type: 'string',
                description: 'New title.'
            },
            startDateTime: {
                type: 'string',
                description: 'New start time.'
            },
            endDateTime: {
                type: 'string',
                description: 'New end time.'
            },
            description: {
                type: 'string',
                description: 'New description.'
            },
            location: {
                type: 'string',
                description: 'New location.'
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
        const { eventId, summary, startDateTime, endDateTime, description, location, calendarId = 'primary' } = args;

        // Log update attempt
        logger.debug(`Updating calendar event: ${eventId}`);

        try {
            // Get Calendar client
            const calendar = await getCalendarClient();

            // Get existing event
            const existingEvent = await calendar.events.get({
                calendarId,
                eventId
            });

            // Update fields if provided
            const event = existingEvent.data;
            if (summary) event.summary = summary;
            if (description !== undefined) event.description = description;
            if (location !== undefined) event.location = location;

            // Update start time if provided
            if (startDateTime) {
                const isAllDay = !startDateTime.includes('T');
                event.start = isAllDay ? { date: startDateTime } : { dateTime: startDateTime };
            }

            // Update end time if provided
            if (endDateTime) {
                const isAllDay = !endDateTime.includes('T');
                event.end = isAllDay ? { date: endDateTime } : { dateTime: endDateTime };
            }

            // Update the event
            const response = await calendar.events.update({
                calendarId,
                eventId,
                requestBody: event,
                sendUpdates: 'all'
            });

            // Return success with event link
            return handleToolResponse(`Event updated successfully: ${response.data.summary}`);
        } catch (error) {
            return handleToolError({ error, message: 'Calendar update failed' });
        }
    }
};