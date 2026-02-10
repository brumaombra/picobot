// Date and time tool
export const getDateTimeTool = {
    // Tool definition
    name: 'get_datetime',
    description: 'Get the current date and time as an ISO 8601 string.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        try {
            // Get current date and time
            const now = new Date();

            // Return the ISO date/time string
            return {
                success: true,
                output: now.toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: `Date/time retrieval failed: ${error.message}`
            };
        }
    }
};