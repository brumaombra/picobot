import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { loadJobsFromFiles, saveJobToFile, deleteJobFile } from './persistent.js';
import { sendOutbound, pushInbound } from '../bus/message-bus.js';
import { generateUniqueId } from '../utils/utils.js';

// In-memory storage for scheduled jobs
const jobs = new Map();

// Serialize job for external use (excludes task reference)
const serializeJob = job => ({
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    action: job.action,
    chatId: job.chatId,
    platform: job.platform,
    message: job.message
});

// Initialize job manager - loads jobs from disk and schedules them
export const initializeJobManager = () => {
    try {
        // Load jobs from persistent storage
        const loadedJobs = loadJobsFromFiles();

        // Schedule each loaded job
        for (const [jobId, jobData] of loadedJobs) {
            try {
                // Validate cron expression
                if (!cron.validate(jobData.schedule)) {
                    logger.error(`Invalid cron schedule for job ${jobId}: ${jobData.schedule}`);
                    continue;
                }

                // Create the scheduled task
                const task = cron.schedule(jobData.schedule, async () => {
                    await executeJob(jobId);
                });

                // Store job with task reference
                jobs.set(jobId, {
                    ...jobData,
                    task
                });

                // Log scheduled job
                logger.info(`Scheduled job: ${jobData.name} (${jobData.schedule})`);
            } catch (error) {
                logger.error(`Failed to schedule job ${jobId}: ${error.message}`);
            }
        }

        // Log initialization result
        logger.info(`Job manager initialized with ${jobs.size} jobs`);
    } catch (error) {
        logger.error(`Failed to initialize job manager: ${error.message}`);
    }
};

// Execute a job by ID
const executeJob = async jobId => {
    // Get job details
    const job = jobs.get(jobId);
    if (!job) {
        logger.error(`Job not found: ${jobId}`);
        return;
    }

    // Log job execution start
    logger.info(`Executing job: ${job.name}`);

    try {
        // Execute the job action based on action type
        switch (job.action) {
            // Message action - sends a message via the message bus
            case 'message':
                // Send a message via message bus
                sendOutbound({
                    channel: job.platform,
                    chatId: job.chatId,
                    content: job.message
                });
                break;

            // Agent prompt action - triggers an agent with a specific prompt
            case 'agent_prompt':
                // Trigger an agent with a prompt
                pushInbound({
                    id: generateUniqueId('cron'),
                    channel: job.platform,
                    chatId: job.chatId,
                    senderId: job.chatId,
                    content: job.message,
                    timestamp: new Date(),
                    sessionKey: `${job.platform}_${job.chatId}`
                });
                break;

            // Unknown action type
            default:
                logger.warn(`Unknown job action type: ${job.action}`);
        }

        // Log job completion
        logger.info(`Job completed: ${job.name}`);
    } catch (error) {
        logger.error(`Job execution failed (${job.name}): ${error.message}`);
    }
};

// Create a new cron job
export const createJob = ({ name, schedule, action, chatId, platform, message }) => {
    try {
        // Validate cron expression
        if (!cron.validate(schedule)) {
            return {
                success: false,
                error: `Invalid cron schedule: ${schedule}. Use standard cron syntax (e.g., "0 0 * * *" for daily at midnight).`
            };
        }

        // Generate unique ID
        const jobId = generateUniqueId('job');

        // Create job object
        const job = {
            id: jobId,
            name,
            schedule,
            action,
            chatId,
            platform,
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
        return {
            success: true,
            jobId,
            message: `Job "${name}" created successfully with schedule: ${schedule}`
        };
    } catch (error) {
        logger.error(`Failed to create job: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
};

// List all jobs
export const listJobs = () => {
    const jobsList = [...jobs.values()];
    return jobsList.map(serializeJob);
};

// Get a specific job by ID
export const getJob = jobId => {
    const job = jobs.get(jobId);
    return job ? serializeJob(job) : null;
};

// Update a job
export const updateJob = (jobId, updates) => {
    try {
        // Get job details
        const job = jobs.get(jobId);
        if (!job) {
            return {
                success: false,
                error: `Job not found: ${jobId}`
            };
        }

        // Validate new schedule if provided
        if (updates.schedule && !cron.validate(updates.schedule)) {
            return {
                success: false,
                error: `Invalid cron schedule: ${updates.schedule}`
            };
        }

        // Apply updates
        Object.assign(job, updates);

        // Always recreate task to ensure schedule is current
        job.task.stop();
        job.task.destroy();
        job.task = cron.schedule(job.schedule, async () => {
            await executeJob(jobId);
        });

        // Save to disk
        saveJobToFile(jobId, job);
        logger.info(`Updated job: ${job.name}`);

        // Return success response
        return {
            success: true,
            message: `Job "${job.name}" updated successfully`
        };
    } catch (error) {
        logger.error(`Failed to update job ${jobId}: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
};

// Delete a job
export const deleteJob = jobId => {
    try {
        // Get job details
        const job = jobs.get(jobId);
        if (!job) {
            return {
                success: false,
                error: `Job not found: ${jobId}`
            };
        }

        // Stop and destroy the task
        job.task.stop();
        job.task.destroy();

        // Remove from memory
        jobs.delete(jobId);

        // Remove from disk
        deleteJobFile(jobId);
        logger.info(`Deleted job: ${job.name}`);

        // Return success response
        return {
            success: true,
            message: `Job "${job.name}" deleted successfully`
        };
    } catch (error) {
        logger.error(`Failed to delete job ${jobId}: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
};