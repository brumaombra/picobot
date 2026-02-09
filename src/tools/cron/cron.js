import { logger } from '../../utils/logger.js';
import { createJob, listJobs, getJob, updateJob, deleteJob } from '../../jobs/manager.js';

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
            logger.error(`Cron create error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// List all cron jobs tool
export const cronListTool = {
    // Tool definition
    name: 'cron_list',
    description: 'List all scheduled cron jobs.',
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

            // Return the list of jobs
            return {
                success: true,
                output: jobs
            };
        } catch (error) {
            logger.error(`Cron list error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
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
                return {
                    success: false,
                    error: `Job not found: ${args.jobId}`
                };
            }

            // Return the job details
            return {
                success: true,
                output: job
            };
        } catch (error) {
            logger.error(`Cron get error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
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
            logger.error(`Cron update error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
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
            logger.error(`Cron delete error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
};