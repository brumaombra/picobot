import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { jobs, serializeJob, executeJob } from '../../jobs/manager.js';
import { saveJobToFile, deleteJobFile } from '../../jobs/persistent.js';
import { generateUniqueId, handleToolError, handleToolResponse, parseSessionKey } from '../../utils/utils.js';

// Create cron job tool
export const cronCreateTool = {
    // Tool definition
    name: 'cron_create',
    description: 'Schedule a new cron job that runs automatically.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Job name for identification.'
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
            const jobId = generateUniqueId('job');

            // Create job object
            const job = {
                id: jobId,
                name,
                schedule,
                action: action_type,
                chatId,
                channel,
                message,
                task: null
            };

            // Create the scheduled task
            job.task = cron.schedule(schedule, async () => {
                await executeJob(jobId);
            });

            // Store in memory
            jobs.set(jobId, job);

            // Save to disk
            saveJobToFile(jobId, job);
            logger.info(`Created job: ${name} (${schedule})`);

            // Return success response
            return handleToolResponse({
                jobId,
                message: `Job "${name}" created successfully with schedule: ${schedule}`
            });
        } catch (error) {
            return handleToolError({ error, message: 'Cron create failed' });
        }
    }
};

// List all cron jobs tool
export const cronListTool = {
    // Tool definition
    name: 'cron_list',
    description: 'List all scheduled cron jobs with metadata. Use cron_get to get detailed information.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        try {
            // List all jobs
            const jobsList = [...jobs.values()].map(serializeJob);
            if (jobsList.length === 0) {
                return handleToolResponse('No scheduled jobs found.');
            }

            // Return metadata only
            const metadata = jobsList.map(job => ({
                id: job.id,
                name: job.name,
                schedule: job.schedule,
                action: job.action
            }));

            // Return the list of jobs
            return handleToolResponse(metadata);
        } catch (error) {
            return handleToolError({ error, message: 'Cron list failed' });
        }
    }
};

// Get specific cron job details tool
export const cronGetTool = {
    // Tool definition
    name: 'cron_get',
    description: 'Get detailed information about a specific cron job by its ID.',
    parameters: {
        type: 'object',
        properties: {
            jobId: {
                type: 'string',
                description: 'Job ID to get details for.'
            }
        },
        required: ['jobId']
    },

    // Main execution function
    execute: async args => {
        try {
            // Get the job details
            const job = jobs.get(args.jobId);
            if (!job) {
                return handleToolError({ message: `Job not found: ${args.jobId}` });
            }

            // Return the job details
            return handleToolResponse(serializeJob(job));
        } catch (error) {
            return handleToolError({ error, message: 'Cron get failed' });
        }
    }
};

// Update existing cron job tool
export const cronUpdateTool = {
    // Tool definition
    name: 'cron_update',
    description: 'Update an existing cron job. Only provide fields to change.',
    parameters: {
        type: 'object',
        properties: {
            jobId: {
                type: 'string',
                description: 'Job ID to update.'
            },
            name: {
                type: 'string',
                description: 'Job name (optional).'
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
        required: ['jobId']
    },

    // Main execution function
    execute: async (args, context) => {
        try {
            // Get job details
            const job = jobs.get(args.jobId);
            if (!job) {
                return handleToolError({ message: `Job not found: ${args.jobId}` });
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
            Object.assign(job, updates);

            // Always recreate task to ensure schedule is current
            job.task.stop();
            job.task.destroy();
            job.task = cron.schedule(job.schedule, async () => {
                await executeJob(args.jobId);
            });

            // Save to disk
            saveJobToFile(args.jobId, job);
            logger.info(`Updated job: ${job.name}`);

            // Return success response
            return handleToolResponse(`Job "${job.name}" updated successfully`);
        } catch (error) {
            return handleToolError({ error, message: 'Cron update failed' });
        }
    }
};

// Delete cron job tool
export const cronDeleteTool = {
    // Tool definition
    name: 'cron_delete',
    description: 'Delete a scheduled cron job.',
    parameters: {
        type: 'object',
        properties: {
            jobId: {
                type: 'string',
                description: 'Job ID to delete.'
            }
        },
        required: ['jobId']
    },

    // Main execution function
    execute: async args => {
        try {
            // Get job details
            const job = jobs.get(args.jobId);
            if (!job) {
                return handleToolError({ message: `Job not found: ${args.jobId}` });
            }

            // Stop and destroy the task
            job.task.stop();
            job.task.destroy();

            // Remove from memory
            jobs.delete(args.jobId);

            // Remove from disk
            deleteJobFile(args.jobId);
            logger.info(`Deleted job: ${job.name}`);

            // Return success response
            return handleToolResponse(`Job "${job.name}" deleted successfully`);
        } catch (error) {
            return handleToolError({ error, message: 'Cron delete failed' });
        }
    }
};