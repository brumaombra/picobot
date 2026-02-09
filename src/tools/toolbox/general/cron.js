import { logger } from '../../utils/logger.js';
import { createJob, listJobs, getJob, updateJob, deleteJob } from '../../jobs/manager.js';

// Cron job scheduling tool
export const cronTool = {
    // Tool definition
    name: 'cron',
    description: 'Schedule, manage, and control cron jobs. Actions: create (schedule new job), list (show all jobs), get (view job details), update (modify job), delete (remove job). Jobs are always active and persist across restarts. Cron format: "minute hour day month weekday" (e.g., "0 9 * * 1-5" = weekdays at 9 AM).',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'list', 'get', 'update', 'delete'],
                description: 'Action to perform: create (new job), list (all jobs), get (job details), update (modify), delete (remove).'
            },
            jobId: {
                type: 'string',
                description: 'Job ID returned from create action (required for get, update, delete actions to identify which job to operate on).'
            },
            name: {
                type: 'string',
                description: 'Job name/description (required for create, optional for update).'
            },
            schedule: {
                type: 'string',
                description: 'Cron schedule expression (required for create, optional for update). Format: "minute hour day month weekday". Examples: "0 9 * * *" (daily 9 AM), "*/15 * * * *" (every 15 min), "0 0 * * 0" (Sundays midnight), "0 18 * * 1-5" (weekdays 6 PM).'
            },
            action_type: {
                type: 'string',
                enum: ['message', 'agent_prompt'],
                description: 'Type of action to perform when job runs (required for create, optional for update). "message": send text message. "agent_prompt": trigger agent with prompt.'
            },
            message: {
                type: 'string',
                description: 'Content to send/execute (required for create). For action_type=message: the text to send. For action_type=agent_prompt: the prompt for the agent.'
            }
        },
        required: ['action']
    },

    // Main execution function
    execute: async (args, context) => {
        const { action } = args;

        try {
            switch (action) {
                // Create new job
                case 'create': {
                    // Validate required parameters
                    if (!args.name || !args.schedule || !args.action_type || !args.message) {
                        return {
                            success: false,
                            error: 'Missing required parameters. Need: name, schedule, action_type, message.'
                        };
                    }

                    // Create the job
                    const result = createJob({
                        name: args.name,
                        schedule: args.schedule,
                        action: args.action_type,
                        chatId: context?.chatId,
                        platform: context?.channel,
                        message: args.message
                    });

                    // Return result
                    return result;
                }

                // List all jobs
                case 'list': {
                    // List all jobs
                    const jobs = listJobs();
                    if (jobs.length === 0) {
                        return {
                            success: true,
                            jobs: [],
                            message: 'No scheduled jobs found.'
                        };
                    }

                    // Return jobs
                    return {
                        success: true,
                        jobs,
                        message: `Found ${jobs.length} scheduled job(s).`
                    };
                }

                // Get specific job
                case 'get': {
                    // Get specific job
                    if (!args.jobId) {
                        return {
                            success: false,
                            error: 'Missing required parameter: jobId'
                        };
                    }

                    // Get job details
                    const job = getJob(args.jobId);
                    if (!job) {
                        return {
                            success: false,
                            error: `Job not found: ${args.jobId}`
                        };
                    }

                    // Return job details
                    return {
                        success: true,
                        job
                    };
                }

                // Update existing job
                case 'update': {
                    // Update job
                    if (!args.jobId) {
                        return {
                            success: false,
                            error: 'Missing required parameter: jobId'
                        };
                    }

                    // Build updates object
                    const updates = {};
                    if (args.name !== undefined) updates.name = args.name;
                    if (args.schedule !== undefined) updates.schedule = args.schedule;
                    if (args.action_type !== undefined) updates.action = args.action_type;
                    if (args.message !== undefined) {
                        updates.chatId = context?.chatId;
                        updates.platform = context?.channel;
                        updates.message = args.message;
                    }

                    // Update job and return result
                    return updateJob(args.jobId, updates);
                }

                // Delete job
                case 'delete': {
                    // Delete job
                    if (!args.jobId) {
                        return {
                            success: false,
                            error: 'Missing required parameter: jobId'
                        };
                    }

                    // Delete job and return result
                    return deleteJob(args.jobId);
                }

                // Unknown action
                default:
                    return {
                        success: false,
                        error: `Unknown action: ${action}`
                    };
            }
        } catch (error) {
            logger.error(`Cron tool error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
};