import { logger } from '../../utils/logger.js';
import { getCalendarClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

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
            return handleToolResponse('Event deleted successfully');
        } catch (error) {
            return handleToolError({ error, message: 'Calendar delete failed' });
        }
    }
};