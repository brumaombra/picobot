import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { JOBS_DIR } from '../config.js';

// Get job file path
export const getJobFilePath = jobId => {
    return join(JOBS_DIR, `${jobId}.json`);
};

// Save a single job to disk
export const saveJobToFile = (jobId, job) => {
    try {
        // Ensure directory exists
        if (!existsSync(JOBS_DIR)) {
            mkdirSync(JOBS_DIR, { recursive: true });
        }

        // Prepare job data (without the actual cron task reference)
        const { task, ...jobData } = job;

        // Write to file
        const filePath = getJobFilePath(jobId);
        writeFileSync(filePath, JSON.stringify(jobData, null, 2));
        logger.debug(`Job saved: ${jobId}`);
    } catch (error) {
        logger.error(`Failed to save job ${jobId}: ${error.message}`);
    }
};

// Delete a job file from disk
export const deleteJobFile = jobId => {
    try {
        // If the file exists, delete it
        const filePath = getJobFilePath(jobId);
        if (existsSync(filePath)) {
            unlinkSync(filePath);
            logger.debug(`Job file deleted: ${jobId}`);
        }
    } catch (error) {
        logger.error(`Failed to delete job file ${jobId}: ${error.message}`);
    }
};

// Load all jobs from disk
export const loadJobsFromFiles = () => {
    const jobsMap = new Map();

    try {
        // Check if jobs directory exists
        if (!existsSync(JOBS_DIR)) {
            logger.debug('No existing jobs directory found');
            return jobsMap;
        }

        // Read all JSON files from jobs directory
        const files = readdirSync(JOBS_DIR).filter(file => file.endsWith('.json'));
        for (const file of files) {
            try {
                // Read and parse job file
                const filePath = join(JOBS_DIR, file);
                const content = readFileSync(filePath, 'utf-8');
                const job = { ...JSON.parse(content), task: null };
                jobsMap.set(job.id, job);
            } catch (error) {
                logger.error(`Failed to load job file ${file}: ${error.message}`);
            }
        }

        // Log number of loaded jobs
        logger.info(`Loaded ${jobsMap.size} jobs from disk`);
    } catch (error) {
        logger.error(`Failed to load jobs: ${error.message}`);
    }

    // Return the map of jobs
    return jobsMap;
};