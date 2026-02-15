import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { crons, serializeCron, executeCron } from '../../crons/manager.js';
import { saveCronToFile, deleteCronFile } from '../../crons/persistent.js';
import { generateUniqueId, handleToolError, handleToolResponse, parseSessionKey } from '../../utils/utils.js';

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
    execute: async () => {
        try {
            // List all crons
            const cronsList = [...crons.values()].map(serializeCron);
            if (cronsList.length === 0) {
                return handleToolResponse('No scheduled crons found.');
            }

            // Return metadata only
            const metadata = cronsList.map(cronEntry => ({
                id: cronEntry.id,
                name: cronEntry.name,
                schedule: cronEntry.schedule,
                action: cronEntry.action
            }));

            // Return the list of crons
            return handleToolResponse(metadata);
        } catch (error) {
            return handleToolError({ error, message: 'Cron list failed' });
        }
    }
};

// Get specific cron details tool
export const cronGetTool = {
    // Tool definition
    name: 'cron_get',
    description: 'Get detailed information about a specific cron by its ID.',
    parameters: {
        type: 'object',
        properties: {
            cronId: {
                type: 'string',
                description: 'Cron ID to get details for.'
            }
        },
        required: ['cronId']
    },

    // Main execution function
    execute: async args => {
        try {
            // Get the cron details
            const cronEntry = crons.get(args.cronId);
            if (!cronEntry) {
                return handleToolError({ message: `Cron not found: ${args.cronId}` });
            }

            // Return the cron details
            return handleToolResponse(serializeCron(cronEntry));
        } catch (error) {
            return handleToolError({ error, message: 'Cron get failed' });
        }
    }
};

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
    execute: async args => {
        try {
            // Get cron details
            const cronEntry = crons.get(args.cronId);
            if (!cronEntry) {
                return handleToolError({ message: `Cron not found: ${args.cronId}` });
            }

            // Stop and destroy the task
            cronEntry.task.stop();
            cronEntry.task.destroy();

            // Remove from memory
            crons.delete(args.cronId);

            // Remove from disk
            deleteCronFile(args.cronId);
            logger.info(`Deleted cron: ${cronEntry.name}`);

            // Return success response
            return handleToolResponse(`Cron "${cronEntry.name}" deleted successfully`);
        } catch (error) {
            return handleToolError({ error, message: 'Cron delete failed' });
        }
    }
};