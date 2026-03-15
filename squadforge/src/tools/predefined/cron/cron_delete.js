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
        // Validate scheduler manager
        const schedulerManager = runtime?.schedulerManager;
        if (!schedulerManager) {
            throw new Error('Runtime scheduler manager is not available.');
        }

        // Delete the cron
        const deletedEntry = schedulerManager.deleteEntry(cronId);

        // Return success response
        return {
            success: true,
            output: `Cron "${deletedEntry.name}" deleted successfully`
        };
    }
};