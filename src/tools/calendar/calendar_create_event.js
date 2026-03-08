import { logger } from '../../utils/common/logger.js';
import { getCalendarClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Calendar create event tool
export const calendarCreateEventTool = {
    // Tool definition
    name: 'calendar_create_event',
    description: 'Create Google Calendar event with title, time, location, attendees.',
    parameters: {
        type: 'object',
        properties: {
            summary: {
                type: 'string',
                description: 'Event title.'
            },
            startDateTime: {
                type: 'string',
                description: 'Start time (ISO 8601).'
            },
            endDateTime: {
                type: 'string',
                description: 'End time (ISO 8601).'
            },
            description: {
                type: 'string',
                description: 'Event description.'
            },
            location: {
                type: 'string',
                description: 'Event location.'
            },
            attendees: {
                type: 'string',
                description: 'Attendee emails (comma-separated).'
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID (default: primary).'
            }
        },
        required: ['summary', 'startDateTime', 'endDateTime']
    },

    // Main execution function
    execute: async args => {
        const { summary, startDateTime, endDateTime, description, location, attendees, calendarId = 'primary' } = args;

        // Log create attempt
        logger.debug(`Creating calendar event: ${summary}`);

        try {
            // Get Calendar client
            const calendar = await getCalendarClient();

            // Build event object
            const event = {
                summary,
                description,
                location
            };

            // Parse start/end times (check if all-day)
            const isAllDay = !startDateTime.includes('T');
            if (isAllDay) {
                event.start = { date: startDateTime };
                event.end = { date: endDateTime };
            } else {
                event.start = { dateTime: startDateTime };
                event.end = { dateTime: endDateTime };
            }

            // Add attendees if provided
            if (attendees) {
                event.attendees = attendees.split(',').map(email => ({
                    email: email.trim()
                }));
            }

            // Create the event
            const response = await calendar.events.insert({
                calendarId,
                requestBody: event,
                sendUpdates: 'all'
            });

            // Return success with event link
            return handleToolResponse(`Event created successfully. Event ID: ${response.data.id}\nLink: ${response.data.htmlLink}`);
        } catch (error) {
            return handleToolError({ error, message: 'Calendar create failed' });
        }
    }
};