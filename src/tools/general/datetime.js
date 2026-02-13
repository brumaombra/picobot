import { handleToolError } from '../../utils/utils.js';

// Date and time tool
export const getDateTimeTool = {
    // Tool definition
    name: 'get_datetime',
    description: 'Get the current date and time in both UTC and local timezone formats.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Get current date and time
            const now = new Date();
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            // Return both UTC and local date/time strings with timezone
            return {
                success: true,
                output: {
                    utc: now.toISOString(),
                    local: getLocalDateTimeString(now),
                    timezone: timezone
                }
            };
        } catch (error) {
            return handleToolError({ error, message: 'Date/time retrieval failed' });
        }
    }
};

// Helper function to get local datetime string
const getLocalDateTimeString = date => {
    // Extract components of the local date and time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    // Return in ISO-like format with local time and milliseconds
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}