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
        // Validate scheduler manager
        const schedulerManager = runtime?.schedulerManager;
        if (!schedulerManager) {
            throw new Error('Runtime scheduler manager is not available.');
        }

        // List all crons
        const entries = schedulerManager.listEntries();
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
                schedule: entry.schedule,
                action: entry.action
            }))
        };
    }
};