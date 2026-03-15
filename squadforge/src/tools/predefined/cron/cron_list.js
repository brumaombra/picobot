// List all crons tool
export const cronListTool = {
    // Tool definition
    name: 'cron_list',
    description: 'List all scheduled crons with metadata. Use cron_get to get detailed information.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async (_args, { runtime }) => {
        // Validate cron manager
        const cronManager = runtime?.cronManager;
        if (!cronManager) {
            throw new Error('Runtime cron manager is not available.');
        }

        // List all crons
        const entries = cronManager.listCrons();
        if (entries.length === 0) {
            return {
                success: true,
                output: 'No scheduled crons found.'
            };
        }

        // Return metadata only
        return {
            success: true,
            output: entries.map(entry => ({
                id: entry.id,
                name: entry.name,
                schedule: entry.schedule
            }))
        };
    }
};