import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { crons, executeCron } from '../../crons/manager.js';
import { saveCronToFile } from '../../crons/persistent.js';
import { handleToolError, handleToolResponse, parseSessionKey } from '../../utils/utils.js';

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
    execute: async (args, context) => {
        try {
            // Get cron details
            const cronEntry = crons.get(args.cronId);
            if (!cronEntry) {
                return handleToolError({ message: `Cron not found: ${args.cronId}` });
            }

            // Build the updates object with only provided fields
            const updates = {};
            if (args.name !== undefined) updates.name = args.name;
            if (args.schedule !== undefined) updates.schedule = args.schedule;
            if (args.action_type !== undefined) updates.action = args.action_type;
            if (args.message !== undefined) {
                const { channel, chatId } = parseSessionKey(context?.sessionKey || '');
                updates.chatId = chatId;
                updates.channel = channel;
                updates.message = args.message;
            }

            // Validate new schedule if provided
            if (updates.schedule && !cron.validate(updates.schedule)) {
                return handleToolError({ message: `Invalid cron schedule: ${updates.schedule}` });
            }

            // Apply updates
            Object.assign(cronEntry, updates);

            // Always recreate task to ensure schedule is current
            cronEntry.task.stop();
            cronEntry.task.destroy();
            cronEntry.task = cron.schedule(cronEntry.schedule, async () => {
                await executeCron(args.cronId);
            });

            // Save to disk
            saveCronToFile(args.cronId, cronEntry);
            logger.info(`Updated cron: ${cronEntry.name}`);

            // Return success response
            return handleToolResponse(`Cron "${cronEntry.name}" updated successfully`);
        } catch (error) {
            return handleToolError({ error, message: 'Cron update failed' });
        }
    }
};