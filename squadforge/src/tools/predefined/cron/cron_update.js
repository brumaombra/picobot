// Update existing cron tool
export const cronUpdateTool = {
    // Tool definition
    name: 'cron_update',
    description: 'Update an existing cron. Only provide fields to change.',
    parameters: {
        type: 'object',
        properties: {
            cronId: {
                type: 'string',
                description: 'Cron ID to update.'
            },
            name: {
                type: 'string',
                description: 'Cron name (optional).'
            },
            schedule: {
                type: 'string',
                description: 'New cron schedule (optional). Format: "minute hour day month weekday".'
            },
            message: {
                type: 'string',
                description: 'New message content to queue to the agent when the cron runs (optional).'
            }
        },
        required: ['cronId']
    },

    // Main execution function
    execute: async ({ cronId, name, schedule, message }, { runtime, sessionId }) => {
        // Validate cron manager
        const cronManager = runtime?.cronManager;
        if (!cronManager) {
            throw new Error('Runtime cron manager is not available.');
        }

        // Build the updates object with only provided fields
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (schedule !== undefined) updates.schedule = schedule;
        if (message !== undefined) {
            updates.message = message;
            updates.sessionId = sessionId;
        }

        // Update the cron
        const updatedEntry = cronManager.updateCron(cronId, updates);

        // Return success response
        return {
            success: true,
            output: `Cron "${updatedEntry.name}" updated successfully`
        };
    }
};