import { logger } from '../../utils/logger.js';
import { createJob, listJobs, getJob, updateJob, deleteJob } from '../../jobs/manager.js';
import { handleToolError } from '../../utils/utils.js';

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
            // Create the job
            const result = createJob({
                name: args.name,
                schedule: args.schedule,
                action: args.action_type,
                chatId: context?.chatId,
                platform: context?.channel,
                message: args.message
            });

            // Return the result of job creation
            return result;
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
            const jobs = listJobs();
            if (jobs.length === 0) {
                return {
                    success: true,
                    output: 'No scheduled jobs found.'
                };
            }

            // Return metadata only
            const metadata = jobs.map(job => ({
                id: job.id,
                name: job.name,
                schedule: job.schedule,
                action: job.action
            }));

            // Return the list of jobs
            return {
                success: true,
                output: metadata
            };
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
            const job = getJob(args.jobId);
            if (!job) {
                return handleToolError({ message: `Job not found: ${args.jobId}` });
            }

            // Return the job details
            return {
                success: true,
                output: job
            };
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
            const updates = {};

            // Build the updates object with only provided fields
            if (args.name !== undefined) updates.name = args.name;
            if (args.schedule !== undefined) updates.schedule = args.schedule;
            if (args.action_type !== undefined) updates.action = args.action_type;
            if (args.message !== undefined) {
                updates.chatId = context?.chatId;
                updates.platform = context?.channel;
                updates.message = args.message;
            }

            // Update the job with the provided fields
            return updateJob(args.jobId, updates);
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
            // Delete the job
            return deleteJob(args.jobId);
        } catch (error) {
            return handleToolError({ error, message: 'Cron delete failed' });
        }
    }
};