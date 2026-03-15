// Create cron tool
export const cronCreateTool = {
    // Tool definition
    name: 'cron_create',
    description: 'Schedule a new cron that runs automatically.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Cron name for identification.'
            },
            schedule: {
                type: 'string',
                description: 'Cron schedule. Format: "minute hour day month weekday". Examples: "0 9 * * *" (daily 9 AM), "*/15 * * * *" (every 15 min).'
            },
            action_type: {
                type: 'string',
                enum: ['message', 'agent_prompt'],
                description: 'Action type: "message" to send text, "agent_prompt" to trigger agent.'
            },
            message: {
                type: 'string',
                description: 'Content for the action (text message or agent prompt).'
            }
        },
        required: ['name', 'schedule', 'action_type', 'message']
    },

    // Main execution function
    execute: async ({ name, schedule, action_type, message }, { runtime, sessionId }) => {
        // Validate scheduler manager
        const schedulerManager = runtime?.schedulerManager;
        if (!schedulerManager) {
            throw new Error('Runtime scheduler manager is not available.');
        }

        // Create the cron
        const createdEntry = schedulerManager.createEntry({
            name,
            schedule,
            action: action_type,
            message,
            sessionId
        });

        // Return success response
        return {
            success: true,
            output: {
                cronId: createdEntry.id,
                message: `Cron "${createdEntry.name}" created successfully with schedule: ${createdEntry.schedule}`
            }
        };
    }
};