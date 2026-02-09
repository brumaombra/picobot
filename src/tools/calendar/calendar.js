import { logger } from '../../utils/logger.js';
import { getCalendarClient } from '../../utils/google-client.js';

// Calendar list events tool
export const calendarListEventsTool = {
    // Tool definition
    name: 'calendar_list_events',
    description: 'List Google Calendar events within a date range. Returns events with id, summary, start/end times, location, attendees, and description.',
    parameters: {
        type: 'object',
        properties: {
            startDate: {
                type: 'string',
                description: 'Start date in ISO 8601 format (e.g., "2024-01-01" or "2024-01-01T09:00:00Z"). Use timezone if needed.'
            },
            endDate: {
                type: 'string',
                description: 'End date in ISO 8601 format (e.g., "2024-01-31" or "2024-01-31T18:00:00Z"). Use timezone if needed.'
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of events to return (default: 10, max: 100).'
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID (default: "primary" for user\'s main calendar). Use for shared calendars.'
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

            // Format output
            const events = response.data.items.map(event => ({
                id: event.id,
                summary: event.summary || '(No title)',
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                location: event.location || '',
                description: event.description || '',
                attendees: event.attendees?.map(a => a.email) || [],
                htmlLink: event.htmlLink
            }));

            // Return events
            return {
                success: true,
                output: events
            };
        } catch (error) {
            logger.error(`Calendar list error: ${error.message}`);
            return {
                success: false,
                error: `Calendar list failed: ${error.message}`
            };
        }
    }
};

// Calendar create event tool
export const calendarCreateEventTool = {
    // Tool definition
    name: 'calendar_create_event',
    description: 'Create new Google Calendar event. Supports all-day and timed events, location, attendees, reminders, and recurrence rules.',
    parameters: {
        type: 'object',
        properties: {
            summary: {
                type: 'string',
                description: 'Event title/summary (e.g., "Team Meeting").'
            },
            startDateTime: {
                type: 'string',
                description: 'Event start in ISO 8601 format (e.g., "2024-01-15T10:00:00"). Use date only for all-day (e.g., "2024-01-15").'
            },
            endDateTime: {
                type: 'string',
                description: 'Event end in ISO 8601 format (e.g., "2024-01-15T11:00:00"). Use date only for all-day (e.g., "2024-01-15").'
            },
            description: {
                type: 'string',
                description: 'Event description/notes. Optional.'
            },
            location: {
                type: 'string',
                description: 'Event location (e.g., "Conference Room A", "https://meet.google.com/xyz"). Optional.'
            },
            attendees: {
                type: 'string',
                description: 'Comma-separated email addresses of attendees (e.g., "john@example.com, jane@example.com"). Optional.'
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID (default: "primary"). Optional.'
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
            logger.error(`Calendar create error: ${error.message}`);
            return {
                success: false,
                error: `Calendar create failed: ${error.message}`
            };
        }
    }
};

// Calendar update event tool
export const calendarUpdateEventTool = {
    // Tool definition
    name: 'calendar_update_event',
    description: 'Update existing Google Calendar event. Can modify title, time, location, attendees, or description.',
    parameters: {
        type: 'object',
        properties: {
            eventId: {
                type: 'string',
                description: 'Event ID to update (obtained from calendar_list_events).'
            },
            summary: {
                type: 'string',
                description: 'New event title. Optional.'
            },
            startDateTime: {
                type: 'string',
                description: 'New start time in ISO 8601 format. Optional.'
            },
            endDateTime: {
                type: 'string',
                description: 'New end time in ISO 8601 format. Optional.'
            },
            description: {
                type: 'string',
                description: 'New event description. Optional.'
            },
            location: {
                type: 'string',
                description: 'New event location. Optional.'
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID (default: "primary"). Optional.'
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
            logger.error(`Calendar update error: ${error.message}`);
            return {
                success: false,
                error: `Calendar update failed: ${error.message}`
            };
        }
    }
};

// Calendar delete event tool
export const calendarDeleteEventTool = {
    // Tool definition
    name: 'calendar_delete_event',
    description: 'Delete Google Calendar event by ID. Permanently removes the event from the calendar.',
    parameters: {
        type: 'object',
        properties: {
            eventId: {
                type: 'string',
                description: 'Event ID to delete (obtained from calendar_list_events).'
            },
            calendarId: {
                type: 'string',
                description: 'Calendar ID (default: "primary"). Optional.'
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
            logger.error(`Calendar delete error: ${error.message}`);
            return {
                success: false,
                error: `Calendar delete failed: ${error.message}`
            };
        }
    }
};