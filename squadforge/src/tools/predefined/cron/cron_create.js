// Create cron tool
export const cronCreateTool = {
    // Tool definition
    name: 'cron_create',
    description: 'Schedule a new cron that sends a system message to the agent when due.',
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
            message: {
                type: 'string',
                description: 'Message content to queue to the agent as a system message when the cron runs.'
            }
        },
        required: ['name', 'schedule', 'message']
    },

    // Main execution function
    execute: async ({ name, schedule, message }, { runtime, sessionId }) => {
        // Validate cron manager
        const cronManager = runtime?.cronManager;
        if (!cronManager) {
            throw new Error('Runtime cron manager is not available.');
        }

        // Create the cron
        const createdEntry = cronManager.createCron({
            name,
            schedule,
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