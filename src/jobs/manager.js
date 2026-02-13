import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { loadJobsFromFiles } from './persistent.js';
import { sendOutbound, pushInbound } from '../bus/message-bus.js';

// In-memory storage for scheduled jobs
export const jobs = new Map();

// Serialize job for external use (excludes task reference)
export const serializeJob = job => ({
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    action: job.action,
    chatId: job.chatId,
    channel: job.channel,
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
export const executeJob = async jobId => {
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
                    sessionKey: `${job.channel}_${job.chatId}`,
                    content: job.message
                });
                break;

            // Agent prompt action - triggers an agent with a specific prompt
            case 'agent_prompt':
                // Trigger an agent with a prompt
                pushInbound({
                    sessionKey: `${job.channel}_${job.chatId}`,
                    content: job.message
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