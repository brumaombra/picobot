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
            action_type: {
                type: 'string',
                enum: ['message', 'agent_prompt'],
                description: 'New action type (optional).'
            },
            message: {
                type: 'string',
                description: 'New content (optional).'
            }
        },
        required: ['cronId']
    },

    // Main execution function
    execute: async ({ cronId, name, schedule, action_type, message }, { runtime, sessionId }) => {
        // Validate scheduler manager
        const schedulerManager = runtime?.schedulerManager;
        if (!schedulerManager) {
            throw new Error('Runtime scheduler manager is not available.');
        }

        // Build the updates object with only provided fields
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (schedule !== undefined) updates.schedule = schedule;
        if (action_type !== undefined) updates.action = action_type;
        if (message !== undefined) {
            updates.message = message;
            updates.sessionId = sessionId;
        }

        // Update the cron
        const updatedEntry = schedulerManager.updateEntry(cronId, updates);

        // Return success response
        return {
            success: true,
            output: `Cron "${updatedEntry.name}" updated successfully`
        };
    }
};