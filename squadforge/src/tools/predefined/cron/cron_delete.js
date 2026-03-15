// Delete cron tool
export const cronDeleteTool = {
    // Tool definition
    name: 'cron_delete',
    description: 'Delete a scheduled cron.',
    parameters: {
        type: 'object',
        properties: {
            cronId: {
                type: 'string',
                description: 'Cron ID to delete.'
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

        // Delete the cron
        const deletedEntry = cronManager.deleteCron(cronId);

        // Return success response
        return {
            success: true,
            output: `Cron "${deletedEntry.name}" deleted successfully`
        };
    }
};