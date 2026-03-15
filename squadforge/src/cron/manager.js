import cron from 'node-cron';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadCronsFromDirectory } from '../loaders/load-crons.js';
import { queueRuntimeMessage } from '../runtime/channel.js';
import { generateId } from '../utils/utils.js';

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

// Create a runtime-owned cron manager backed by one store and one runtime.
export const createCronManager = (options = {}) => {
    const {
        runtime,
        cronsDir,
        logger = runtime?.logger || console
    } = options;

    if (!runtime) {
        throw new Error('createCronManager requires a runtime object.');
    }

    if (!cronsDir || typeof cronsDir !== 'string') {
        throw new Error('createCronManager requires a cronsDir string.');
    }

    const crons = new Map();
    const log = createLogger(logger);

    const serializeCron = entry => stripTask(entry);

    const withDefaults = input => {
        return {
            ...stripTask(input),
            id: input?.id || generateId('cron'),
            task: null
        };
    };

    const notifySession = (sessionId, content) => {
        queueRuntimeMessage(runtime, {
            sessionId,
            role: 'system',
            content
        });
    };

    const getCronFilePath = cronId => {
        return join(cronsDir, `${cronId}.json`);
    };

    const ensureCronsDirectory = () => {
        if (!existsSync(cronsDir)) {
            mkdirSync(cronsDir, { recursive: true });
        }
    };

    const loadPersistedCrons = () => {
        try {
            if (!existsSync(cronsDir)) {
                log('debug', 'No existing crons directory found');
                return new Map();
            }

            const entries = loadCronsFromDirectory({ cronsDir });
            log('info', `Loaded ${entries.size} crons from disk`);
            return entries;
        } catch (error) {
            log('error', `Failed to load crons: ${toErrorMessage(error)}`);
            return new Map();
        }
    };

    const savePersistedCron = (cronId, cronEntry) => {
        try {
            ensureCronsDirectory();
            writeFileSync(getCronFilePath(cronId), JSON.stringify(cronEntry, null, 2));
            log('debug', `Cron saved: ${cronId}`);
        } catch (error) {
            log('error', `Failed to save cron ${cronId}: ${toErrorMessage(error)}`);
        }
    };

    const deletePersistedCron = cronId => {
        try {
            const filePath = getCronFilePath(cronId);
            if (existsSync(filePath)) {
                unlinkSync(filePath);
                log('debug', `Cron file deleted: ${cronId}`);
            }
        } catch (error) {
            log('error', `Failed to delete cron file ${cronId}: ${toErrorMessage(error)}`);
        }
    };

    const scheduleCronTask = entry => {
        entry.task = cron.schedule(entry.schedule, async () => {
            await manager.executeCron(entry.id);
        });

        return entry;
    };

    const clearCrons = () => {
        for (const entry of crons.values()) {
            try {
                stopTask(entry.task);
            } catch (error) {
                log('warn', `Failed to stop cron ${entry.id}: ${toErrorMessage(error)}`);
            }
        }

        crons.clear();
    };

    const manager = {
        crons,

        serializeCron: entry => serializeCron(entry),

        initialize: () => {
            clearCrons();

            try {
                const loadedCrons = loadPersistedCrons() || new Map();
                for (const [cronId, rawEntry] of loadedCrons) {
                    try {
                        const entry = withDefaults({
                            ...rawEntry,
                            id: rawEntry?.id || cronId
                        });

                        validateCron(entry);
                        scheduleCronTask(entry);
                        crons.set(entry.id, entry);
                        log('info', `Cron loaded: ${entry.name} (${entry.schedule})`);
                    } catch (error) {
                        log('error', `Failed to load cron ${cronId}: ${toErrorMessage(error)}`);
                    }
                }

                log('info', `Cron manager initialized with ${crons.size} crons`);
            } catch (error) {
                log('error', `Failed to initialize cron manager: ${toErrorMessage(error)}`);
            }

            return crons;
        },

        stop: () => {
            clearCrons();
            log('info', 'Cron manager stopped');
        },

        getCron: id => {
            return crons.get(id) || null;
        },

        listCrons: () => {
            return [...crons.values()].map(entry => serializeCron(entry));
        },

        createCron: input => {
            const entry = withDefaults(input);

            validateCron(entry);
            scheduleCronTask(entry);
            crons.set(entry.id, entry);
            savePersistedCron(entry.id, serializeCron(entry));
            log('info', `Created cron: ${entry.name} (${entry.schedule})`);

            return serializeCron(entry);
        },

        updateCron: (id, updates = {}) => {
            const currentEntry = crons.get(id);
            if (!currentEntry) {
                throw new Error(`Cron not found: ${id}`);
            }

            const nextEntry = withDefaults({
                ...stripTask(currentEntry),
                ...updates,
                id
            });

            validateCron(nextEntry);
            stopTask(currentEntry.task);
            scheduleCronTask(nextEntry);
            crons.set(id, nextEntry);
            savePersistedCron(id, serializeCron(nextEntry));
            log('info', `Updated cron: ${nextEntry.name}`);

            return serializeCron(nextEntry);
        },

        deleteCron: id => {
            const entry = crons.get(id);
            if (!entry) {
                throw new Error(`Cron not found: ${id}`);
            }

            stopTask(entry.task);
            crons.delete(id);
            deletePersistedCron(id);
            log('info', `Deleted cron: ${entry.name}`);

            return serializeCron(entry);
        },

        executeCron: async id => {
            const entry = crons.get(id);
            if (!entry) {
                log('error', `Cron not found: ${id}`);
                return null;
            }

            log('info', `Executing cron: ${entry.name}`);

            try {
                notifySession(entry.sessionId, entry.message);
                log('info', `Cron queued: ${entry.name}`);
                return serializeCron(entry);
            } catch (error) {
                const errorMessage = toErrorMessage(error);
                log('error', `Cron execution failed (${entry.name}): ${errorMessage}`);

                return null;
            }
        }
    };

    return manager;
};