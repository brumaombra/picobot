import { handleToolError, handleToolResponse, formatLocalDateTimeString } from '../../../src/utils/common/utils.js';

// Date and time tool
export const getDateTimeTool = {
    // Tool definition
    name: 'get_datetime',
    description: 'Get the current local date and time with timezone.',
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

            // Return local date/time string with timezone
            return handleToolResponse({
                local: formatLocalDateTimeString(now),
                timezone: timezone
            });
        } catch (error) {
            return handleToolError({ error, message: 'Date/time retrieval failed' });
        }
    }
};