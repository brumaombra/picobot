import cron from 'node-cron';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadCronsFromDirectory } from '../loaders/load-crons.js';
import { queueRuntimeMessage } from '../runtime/channel.js';
import { generateId } from '../utils/utils.js';

// Create a runtime-owned cron manager backed by one store and one runtime.
export class CronManager {
    constructor({ runtime, cronsDir, logger = runtime?.logger || console } = {}) {
        if (!runtime) {
            throw new Error('CronManager requires a runtime object.');
        }

        if (!cronsDir || typeof cronsDir !== 'string') {
            throw new Error('CronManager requires a cronsDir string.');
        }

        this.runtime = runtime;
        this.cronsDir = cronsDir;
        this.crons = new Map();
        this.log = createLogger(logger);
    }

    serializeCron(entry) {
        return stripTask(entry);
    }

    toCronData(input) {
        return {
            ...stripTask(input),
            id: input?.id || generateId('cron'),
            task: null
        };
    }

    notifySession(sessionId, content) {
        queueRuntimeMessage(this.runtime, {
            sessionId,
            role: 'system',
            content
        });
    }

    getCronFilePath(cronId) {
        return join(this.cronsDir, `${cronId}.json`);
    }

    ensureCronsDirectory() {
        if (!existsSync(this.cronsDir)) {
            mkdirSync(this.cronsDir, { recursive: true });
        }
    }

    loadPersistedCrons() {
        try {
            if (!existsSync(this.cronsDir)) {
                this.log('debug', 'No existing crons directory found');
                return new Map();
            }

            const entries = loadCronsFromDirectory({ cronsDir: this.cronsDir });
            this.log('info', `Loaded ${entries.size} crons from disk`);
            return entries;
        } catch (error) {
            this.log('error', `Failed to load crons: ${toErrorMessage(error)}`);
            return new Map();
        }
    }

    savePersistedCron(cronId, cronEntry) {
        try {
            this.ensureCronsDirectory();
            writeFileSync(this.getCronFilePath(cronId), JSON.stringify(cronEntry, null, 2));
            this.log('debug', `Cron saved: ${cronId}`);
        } catch (error) {
            this.log('error', `Failed to save cron ${cronId}: ${toErrorMessage(error)}`);
        }
    }

    deletePersistedCron(cronId) {
        try {
            const filePath = this.getCronFilePath(cronId);
            if (existsSync(filePath)) {
                unlinkSync(filePath);
                this.log('debug', `Cron file deleted: ${cronId}`);
            }
        } catch (error) {
            this.log('error', `Failed to delete cron file ${cronId}: ${toErrorMessage(error)}`);
        }
    }

    async executeCron(id) {
        const entry = this.crons.get(id);
        if (!entry) {
            this.log('error', `Cron not found: ${id}`);
            return null;
        }

        this.log('info', `Executing cron: ${entry.name}`);

        try {
            this.notifySession(entry.sessionId, entry.message);
            this.log('info', `Cron queued: ${entry.name}`);
            return stripTask(entry);
        } catch (error) {
            const errorMessage = toErrorMessage(error);
            this.log('error', `Cron execution failed (${entry.name}): ${errorMessage}`);
            return null;
        }
    }

    scheduleCronTask(entry) {
        entry.task = cron.schedule(entry.schedule, async () => {
            await this.executeCron(entry.id);
        });

        return entry;
    }

    registerCron(input, { persist = true } = {}) {
        const existingEntry = input?.id ? this.crons.get(input.id) : null;
        const entry = this.toCronData(existingEntry ? { ...stripTask(existingEntry), ...input } : input);

        validateCron(entry);

        if (existingEntry?.task) {
            stopTask(existingEntry.task);
        }

        this.scheduleCronTask(entry);
        this.crons.set(entry.id, entry);

        if (persist) {
            this.savePersistedCron(entry.id, stripTask(entry));
        }

        return stripTask(entry);
    }

    clearCrons() {
        for (const entry of this.crons.values()) {
            try {
                stopTask(entry.task);
            } catch (error) {
                this.log('warn', `Failed to stop cron ${entry.id}: ${toErrorMessage(error)}`);
            }
        }

        this.crons.clear();
    }

    initialize() {
        this.clearCrons();

        try {
            const loadedCrons = this.loadPersistedCrons() || new Map();
            for (const [cronId, rawEntry] of loadedCrons) {
                try {
                    const entry = this.registerCron({
                        ...rawEntry,
                        id: rawEntry?.id || cronId
                    }, { persist: false });

                    this.log('info', `Cron loaded: ${entry.name} (${entry.schedule})`);
                } catch (error) {
                    this.log('error', `Failed to load cron ${cronId}: ${toErrorMessage(error)}`);
                }
            }

            this.log('info', `Cron manager initialized with ${this.crons.size} crons`);
        } catch (error) {
            this.log('error', `Failed to initialize cron manager: ${toErrorMessage(error)}`);
        }

        return this.crons;
    }

    stop() {
        this.clearCrons();
        this.log('info', 'Cron manager stopped');
    }

    getCron(id) {
        return this.crons.get(id) || null;
    }

    listCrons() {
        return [...this.crons.values()].map(entry => stripTask(entry));
    }

    createCron(input) {
        const entry = this.registerCron(input);
        this.log('info', `Created cron: ${entry.name} (${entry.schedule})`);
        return entry;
    }

    updateCron(id, updates = {}) {
        if (!this.crons.has(id)) {
            throw new Error(`Cron not found: ${id}`);
        }

        const entry = this.registerCron({
            ...updates,
            id
        });

        this.log('info', `Updated cron: ${entry.name}`);
        return entry;
    }

    deleteCron(id) {
        const entry = this.crons.get(id);
        if (!entry) {
            throw new Error(`Cron not found: ${id}`);
        }

        stopTask(entry.task);
        this.crons.delete(id);
        this.deletePersistedCron(id);
        this.log('info', `Deleted cron: ${entry.name}`);
        return stripTask(entry);
    }
}

const toErrorMessage = error => {
    return error instanceof Error ? error.message : String(error);
};

const stopTask = task => {
    task?.stop?.();
    task?.destroy?.();
};

const stripTask = entry => {
    const { task, action, ...data } = entry || {};
    return data;
};

const createLogger = logger => {
    return (level, message) => {
        const loggerFn = logger?.[level];
        if (typeof loggerFn === 'function') {
            loggerFn.call(logger, message);
            return;
        }

        const fallback = console[level] || console.log;
        fallback(message);
    };
};

const validateCron = entry => {
    if (!entry?.id || typeof entry.id !== 'string') {
        throw new Error('Cron requires a string id.');
    }

    if (!entry?.name || typeof entry.name !== 'string') {
        throw new Error('Cron requires a name.');
    }

    if (!entry?.sessionId || typeof entry.sessionId !== 'string') {
        throw new Error('Cron requires a sessionId.');
    }

    if (!entry?.message || typeof entry.message !== 'string') {
        throw new Error('Cron requires a message.');
    }

    if (!entry?.schedule || typeof entry.schedule !== 'string' || !cron.validate(entry.schedule)) {
        throw new Error(`Invalid cron schedule: ${entry?.schedule}`);
    }
};