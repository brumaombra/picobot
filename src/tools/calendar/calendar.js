import { logger } from '../../utils/logger.js';
import { getCalendarClient } from '../../utils/google-client.js';
import { handleToolError } from '../../utils/utils.js';

// Calendar list events tool
export const calendarListEventsTool = {
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
                return {
                    success: true,
                    output: 'No events found in the specified date range.'
                };
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
            return {
                success: true,
                output: events
            };
        } catch (error) {
            return handleToolError({ error, message: 'Calendar list failed' });
        }
    }
};

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
            return {
                success: true,
                output: {
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
                }
            };
        } catch (error) {
            return handleToolError({ error, message: 'Calendar get failed' });
        }
    }
};

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
            return {
                success: true,
                output: `Event created successfully. Event ID: ${response.data.id}\nLink: ${response.data.htmlLink}`
            };
        } catch (error) {
            return handleToolError({ error, message: 'Calendar create failed' });
        }
    }
};

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
            return {
                success: true,
                output: `Event updated successfully: ${response.data.summary}`
            };
        } catch (error) {
            return handleToolError({ error, message: 'Calendar update failed' });
        }
    }
};

// Calendar delete event tool
export const calendarDeleteEventTool = {
    // Tool definition
    name: 'calendar_delete_event',
    description: 'Delete Google Calendar event.',
    parameters: {
        type: 'object',
        properties: {
            eventId: {
                type: 'string',
                description: 'Event ID to delete.'
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

        // Log delete attempt
        logger.debug(`Deleting calendar event: ${eventId}`);

        try {
            // Get Calendar client
            const calendar = await getCalendarClient();

            // Delete the event
            await calendar.events.delete({
                calendarId,
                eventId,
                sendUpdates: 'all'
            });

            // Return success with event link
            return {
                success: true,
                output: 'Event deleted successfully'
            };
        } catch (error) {
            return handleToolError({ error, message: 'Calendar delete failed' });
        }
    }
};