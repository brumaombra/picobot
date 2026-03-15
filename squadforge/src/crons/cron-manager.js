import cron from 'node-cron';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../logging/logger.js';
import { queueRuntimeMessage } from '../runtime/channel.js';
import { generateId } from '../utils/utils.js';

// Cron manager with optional disk persistence
export class CronManager {
    // Constructor
    constructor({ runtime, cronsDir, crons = null } = {}) {
        // Validate the runtime object
        if (!runtime) {
            throw new Error('CronManager requires a runtime object.');
        }

        // Validate the crons directory
        if (!cronsDir || typeof cronsDir !== 'string') {
            throw new Error('CronManager requires a cronsDir string.');
        }

        // Save the properties
        this.runtime = runtime;
        this.cronsDir = cronsDir;
        this.crons = crons instanceof Map ? new Map(crons) : new Map();
    }

    // Remove runtime-only task state before returning cron data
    serializeCron(entry) {
        return stripTask(entry);
    }

    // Normalize cron input into the runtime shape
    toCronData(input) {
        return {
            ...stripTask(input),
            id: input?.id || generateId('cron'),
            task: null
        };
    }

    // Queue a cron message into the runtime for the target session
    notifySession(sessionId, content) {
        queueRuntimeMessage(this.runtime, {
            sessionId,
            role: 'system',
            content
        });
    }

    // Get the file path for a cron
    getCronFilePath(cronId) {
        return join(this.cronsDir, `${cronId}.json`);
    }

    // Ensure the crons directory exists
    ensureCronsDir() {
        if (!existsSync(this.cronsDir)) {
            mkdirSync(this.cronsDir, { recursive: true });
        }
    }

    // Save a cron to disk if persistence is enabled
    saveCron(cronId, cronEntry) {
        try {
            this.ensureCronsDir();
            writeFileSync(this.getCronFilePath(cronId), JSON.stringify(cronEntry, null, 2));
            logger.debug(`Cron saved: ${cronId}`);
        } catch (error) {
            logger.error(`Failed to save cron ${cronId}: ${toErrorMessage(error)}`);
        }
    }

    // Queue a due cron for execution
    async executeCron(id) {
        // Get the cron entry by ID and return early if not found
        const entry = this.crons.get(id);
        if (!entry) {
            logger.error(`Cron not found: ${id}`);
            return null;
        }

        // Log the cron execution
        logger.info(`Executing cron: ${entry.name}`);

        try {
            this.notifySession(entry.sessionId, entry.message);
            logger.info(`Cron queued: ${entry.name}`);
            return stripTask(entry);
        } catch (error) {
            const errorMessage = toErrorMessage(error);
            logger.error(`Cron execution failed (${entry.name}): ${errorMessage}`);
            return null;
        }
    }

    // Start the runtime task for one cron
    scheduleCronTask(entry) {
        // Create a cron task
        entry.task = cron.schedule(entry.schedule, async () => {
            await this.executeCron(entry.id);
        });

        // Return the cron
        return entry;
    }

    // Register or replace one cron in memory and optionally persist it
    registerCron(input, { persist = true } = {}) {
        // Merge the new input with any existing cron entry
        const existingEntry = input?.id ? this.crons.get(input.id) : null;
        const entry = this.toCronData(existingEntry ? { ...stripTask(existingEntry), ...input } : input);

        // Validate the normalized cron data before scheduling it
        validateCron(entry);

        // Stop the previous runtime task before replacing it
        if (existingEntry?.task) {
            stopTask(existingEntry.task);
        }

        // Schedule and store the updated cron entry
        this.scheduleCronTask(entry);
        this.crons.set(entry.id, entry);

        // Persist the cron to disk when requested
        if (persist) {
            this.saveCron(entry.id, stripTask(entry));
        }

        // Return the serialized cron data without the runtime task
        return stripTask(entry);
    }

    // Stop all cron tasks and clear the in-memory map
    clearCrons() {
        // Stop every scheduled runtime task before clearing the map
        for (const entry of this.crons.values()) {
            try {
                stopTask(entry.task);
            } catch (error) {
                logger.warn(`Failed to stop cron ${entry.id}: ${toErrorMessage(error)}`);
            }
        }

        // Remove all cron entries from memory
        this.crons.clear();
    }

    // Initialize cron tasks from the preloaded cron map
    initialize() {
        try {
            // Rebuild all preloaded cron tasks from the in-memory snapshot
            const preloadedCrons = new Map(this.crons);
            this.clearCrons();

            for (const [cronId, rawEntry] of preloadedCrons) {
                try {
                    const entry = this.registerCron({
                        ...rawEntry,
                        id: rawEntry?.id || cronId
                    }, { persist: false });

                    logger.info(`Cron loaded: ${entry.name} (${entry.schedule})`);
                } catch (error) {
                    logger.error(`Failed to load cron ${cronId}: ${toErrorMessage(error)}`);
                }
            }

            // Log the final initialization result
            logger.info(`Cron manager initialized with ${this.crons.size} crons`);
        } catch (error) {
            logger.error(`Failed to initialize cron manager: ${toErrorMessage(error)}`);
        }

        // Return the active cron map after initialization
        return this.crons;
    }

    // Stop all running cron tasks
    stop() {
        this.clearCrons();
        logger.info('Cron manager stopped');
    }

    // Get a cron by its ID
    getCron(id) {
        return this.crons.get(id) || null;
    }

    // List all registered crons without runtime-only task state
    listCrons() {
        return [...this.crons.values()].map(entry => stripTask(entry));
    }

    // Create and persist a new cron
    createCron(input) {
        // Register the cron and return the serialized result
        const entry = this.registerCron(input);
        logger.info(`Created cron: ${entry.name} (${entry.schedule})`);
        return entry;
    }

    // Update and persist an existing cron
    updateCron(id, updates = {}) {
        // Reject updates for unknown cron IDs
        if (!this.crons.has(id)) {
            throw new Error(`Cron not found: ${id}`);
        }

        // Re-register the cron with the provided updates
        const entry = this.registerCron({
            ...updates,
            id
        });

        logger.info(`Updated cron: ${entry.name}`);
        return entry;
    }

    // Delete a cron from memory and disk
    deleteCron(id) {
        // Reject deletes for unknown cron IDs
        const entry = this.crons.get(id);
        if (!entry) {
            throw new Error(`Cron not found: ${id}`);
        }

        // Delete the cron from memory
        stopTask(entry.task);
        this.crons.delete(id);

        // Delete the cron file from disk if it exists
        try {
            const filePath = this.getCronFilePath(id);
            if (existsSync(filePath)) {
                unlinkSync(filePath);
                logger.debug(`Cron file deleted: ${id}`);
            }
        } catch (error) {
            logger.error(`Failed to delete cron file ${id}: ${toErrorMessage(error)}`);
        }

        logger.info(`Deleted cron: ${entry.name}`);
        return stripTask(entry);
    }
}

// Convert an error object or value into a string message
const toErrorMessage = error => {
    return error instanceof Error ? error.message : String(error);
};

// Stop and destroy one cron task when present
const stopTask = task => {
    task?.stop?.();
    task?.destroy?.();
};

// Remove runtime-only task state before serializing cron data
const stripTask = entry => {
    const { task, action, ...data } = entry || {};
    return data;
};

// Validate the required cron fields before registration
const validateCron = entry => {
    // Require a stable string ID for persistence and lookup
    if (!entry?.id || typeof entry.id !== 'string') {
        throw new Error('Cron requires a string id.');
    }

    // Require a user-facing cron name
    if (!entry?.name || typeof entry.name !== 'string') {
        throw new Error('Cron requires a name.');
    }

    // Require the target session ID for runtime delivery
    if (!entry?.sessionId || typeof entry.sessionId !== 'string') {
        throw new Error('Cron requires a sessionId.');
    }

    // Require the message content that will be queued into the session
    if (!entry?.message || typeof entry.message !== 'string') {
        throw new Error('Cron requires a message.');
    }

    // Require a valid cron expression before scheduling the task
    if (!entry?.schedule || typeof entry.schedule !== 'string' || !cron.validate(entry.schedule)) {
        throw new Error(`Invalid cron schedule: ${entry?.schedule}`);
    }
};