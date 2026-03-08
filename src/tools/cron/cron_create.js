import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { crons, executeCron } from '../../crons/manager.js';
import { saveCronToFile } from '../../crons/persistent.js';
import { generateUniqueId, handleToolError, handleToolResponse, parseSessionKey } from '../../utils/common/utils.js';

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
            const { channel, chatId } = parseSessionKey(context?.sessionKey || '');

            // Validate cron expression
            if (!cron.validate(schedule)) {
                return handleToolError({ message: `Invalid cron schedule: ${schedule}. Use standard cron syntax (e.g., "0 0 * * *" for daily at midnight).` });
            }

            // Generate unique ID
            const cronId = generateUniqueId('cron');

            // Create cron object
            const cronEntry = {
                id: cronId,
                name,
                schedule,
                action: action_type,
                chatId,
                channel,
                message,
                task: null
            };

            // Create the scheduled task
            cronEntry.task = cron.schedule(schedule, async () => {
                await executeCron(cronId);
            });

            // Store in memory
            crons.set(cronId, cronEntry);

            // Save to disk
            saveCronToFile(cronId, cronEntry);
            logger.info(`Created cron: ${name} (${schedule})`);

            // Return success response
            return handleToolResponse({
                cronId,
                message: `Cron "${name}" created successfully with schedule: ${schedule}`
            });
        } catch (error) {
            return handleToolError({ error, message: 'Cron create failed' });
        }
    }
};