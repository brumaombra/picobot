// Get specific cron details tool
export const cronGetTool = {
    // Tool definition
    name: 'cron_get',
    description: 'Get detailed information about a specific cron by its ID.',
    parameters: {
        type: 'object',
        properties: {
            cronId: {
                type: 'string',
                description: 'Cron ID to get details for.'
            }
        },
        required: ['cronId']
    },

    // Main execution function
    execute: async ({ cronId }, { runtime }) => {
        // Validate cron manager
        const cronManager = runtime?.cronManager;
        if (!cronManager) {
            throw new Error('Runtime cron manager is not available.');
        }

        // Get the cron details
        const entry = cronManager.getCron(cronId);
        if (!entry) {
            return {
                success: false,
                error: `Cron not found: ${cronId}`
            };
        }

        // Return the cron details
        return {
            success: true,
            output: cronManager.serializeCron(entry)
        };
    }
};