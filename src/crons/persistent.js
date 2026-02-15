import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { CRONS_DIR } from '../config.js';

// Get cron file path
export const getCronFilePath = cronId => {
    return join(CRONS_DIR, `${cronId}.json`);
};

// Save a single cron to disk
export const saveCronToFile = (cronId, cronEntry) => {
    try {
        // Ensure directory exists
        if (!existsSync(CRONS_DIR)) {
            mkdirSync(CRONS_DIR, { recursive: true });
        }

        // Prepare cron data (without the actual cron task reference)
        const { task, ...cronData } = cronEntry;

        // Write to file
        const filePath = getCronFilePath(cronId);
        writeFileSync(filePath, JSON.stringify(cronData, null, 2));
        logger.debug(`Cron saved: ${cronId}`);
    } catch (error) {
        logger.error(`Failed to save cron ${cronId}: ${error.message}`);
    }
};

// Delete a cron file from disk
export const deleteCronFile = cronId => {
    try {
        // If the file exists, delete it
        const filePath = getCronFilePath(cronId);
        if (existsSync(filePath)) {
            unlinkSync(filePath);
            logger.debug(`Cron file deleted: ${cronId}`);
        }
    } catch (error) {
        logger.error(`Failed to delete cron file ${cronId}: ${error.message}`);
    }
};

// Load all crons from disk
export const loadCronsFromFiles = () => {
    const cronsMap = new Map();

    try {
        // Check if crons directory exists
        if (!existsSync(CRONS_DIR)) {
            logger.debug('No existing crons directory found');
            return cronsMap;
        }

        // Read all JSON files from crons directory
        const files = readdirSync(CRONS_DIR).filter(file => file.endsWith('.json'));
        for (const file of files) {
            try {
                // Read and parse cron file
                const filePath = join(CRONS_DIR, file);
                const content = readFileSync(filePath, 'utf-8');
                const cronEntry = { ...JSON.parse(content), task: null };
                cronsMap.set(cronEntry.id, cronEntry);
            } catch (error) {
                logger.error(`Failed to load cron file ${file}: ${error.message}`);
            }
        }

        // Log number of loaded crons
        logger.info(`Loaded ${cronsMap.size} crons from disk`);
    } catch (error) {
        logger.error(`Failed to load crons: ${error.message}`);
    }

    // Return the map of crons
    return cronsMap;
};
