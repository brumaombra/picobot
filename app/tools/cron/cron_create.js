import { createCron } from '../../../src/crons/manager.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

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
    execute: async (args, context) => {
        try {
            // Get arguments and context
            const { name, schedule, action_type, message } = args;

            // Create the cron
            const createdCron = createCron({
                name,
                schedule,
                action: action_type,
                message,
                sessionId: context?.sessionKey
            });

            // Return success response
            return handleToolResponse({
                cronId: createdCron.id,
                message: `Cron "${name}" created successfully with schedule: ${schedule}`
            });
        } catch (error) {
            return handleToolError({ error, message: 'Cron create failed' });
        }
    }
};