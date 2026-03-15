// Get current date and time tool
export const getDatetimeTool = {
    name: 'get_datetime',
    description: 'Get the current date and time for the runtime environment.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        // Capture the current runtime date and time once
        const now = new Date();

        // Return the current date and time in multiple useful formats
        return {
            iso: now.toISOString(),
            unix_ms: now.getTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            local: now.toString()
        };
    }
};