import cron from 'node-cron';
import { queueRuntimeMessage } from '../runtime/channel.js';
import { sendToSession } from '../runtime/lookup.js';
import { generateId, stringifyJson } from '../utils/utils.js';

const ALLOWED_CRON_ACTIONS = new Set(['message', 'agent_prompt']);

const toErrorMessage = error => {
    return error instanceof Error ? error.message : String(error);
};

const stopTask = task => {
    task?.stop?.();
    task?.destroy?.();
};

const stripTask = entry => {
    const { task, ...data } = entry || {};
    return data;
};

// Create a runtime-owned cron manager with injected persistence and notification hooks.
export const createCronManager = (options = {}) => {
    const {
        logger = console,
        createCronId = () => generateId('cron'),
        createIsolatedSessionId = () => generateId('cron'),
        loadCrons = () => new Map(),
        saveCron = () => { },
        deleteCron = () => { },
        hydrateCron = entry => entry,
        serializeCron = stripTask,
        buildMessageNotification = entry => entry.message,
        buildAgentPromptNotification = (entry, result) => ({
            type: 'cron_notification',
            action: entry.action,
            cronId: entry.id,
            status: result.status,
            content: result.content
        })
    } = options;

    const crons = new Map();
    let runtimeAgent = null;

    const log = (level, message) => {
        const loggerFn = logger?.[level];
        if (typeof loggerFn === 'function') {
            loggerFn.call(logger, message);
            return;
        }

        const fallback = console[level] || console.log;
        fallback(message);
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

        if (!entry?.action || !ALLOWED_CRON_ACTIONS.has(entry.action)) {
            throw new Error(`Cron action must be one of: ${[...ALLOWED_CRON_ACTIONS].join(', ')}`);
        }

        if (!entry?.schedule || typeof entry.schedule !== 'string' || !cron.validate(entry.schedule)) {
            throw new Error(`Invalid cron schedule: ${entry?.schedule}`);
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

    const queueNotification = (entry, payload) => {
        if (!runtimeAgent?.runtime) {
            log('error', `Cannot queue cron notification for "${entry.name}": runtime agent not set`);
            return false;
        }

        queueRuntimeMessage(runtimeAgent.runtime, {
            sessionId: entry.sessionId,
            role: 'system',
            content: typeof payload === 'string' ? payload : stringifyJson(payload)
        });

        return true;
    };

    const manager = {
        crons,

        setRuntimeAgent: agent => {
            runtimeAgent = agent;
            log('debug', 'Runtime agent reference set for cron manager');
            return manager;
        },

        serializeCron: entry => serializeCron(entry),

        initialize: () => {
            clearCrons();

            try {
                const loadedCrons = loadCrons() || new Map();
                for (const [cronId, rawEntry] of loadedCrons) {
                    try {
                        const entry = hydrateCron({
                            ...rawEntry,
                            id: rawEntry?.id || cronId,
                            task: null
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
            const entry = hydrateCron({
                ...input,
                id: input?.id || createCronId(),
                task: null
            });

            validateCron(entry);
            scheduleCronTask(entry);
            crons.set(entry.id, entry);
            saveCron(entry.id, serializeCron(entry));
            log('info', `Created cron: ${entry.name} (${entry.schedule})`);

            return serializeCron(entry);
        },

        updateCron: (id, updates = {}) => {
            const currentEntry = crons.get(id);
            if (!currentEntry) {
                throw new Error(`Cron not found: ${id}`);
            }

            const nextEntry = hydrateCron({
                ...stripTask(currentEntry),
                ...updates,
                id,
                task: null
            });

            validateCron(nextEntry);
            stopTask(currentEntry.task);
            scheduleCronTask(nextEntry);
            crons.set(id, nextEntry);
            saveCron(id, serializeCron(nextEntry));
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
            deleteCron(id);
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
                if (entry.action === 'message') {
                    queueNotification(entry, buildMessageNotification(entry));
                    log('info', `Cron completed: ${entry.name}`);
                    return serializeCron(entry);
                }

                if (!runtimeAgent?.runtime) {
                    log('error', `Cannot execute cron agent prompt "${entry.name}": runtime agent not set`);
                    return null;
                }

                const result = await sendToSession(runtimeAgent.runtime, entry.message, {
                    sessionId: createIsolatedSessionId(),
                    role: 'system'
                });

                if (result?.response) {
                    queueNotification(entry, buildAgentPromptNotification(entry, {
                        status: 'completed',
                        content: result.response,
                        timedOut: false
                    }));
                } else if (result?.timedOut) {
                    queueNotification(entry, buildAgentPromptNotification(entry, {
                        status: 'timed_out',
                        content: 'Timed out before completing.',
                        timedOut: true
                    }));
                }

                log('info', `Cron completed: ${entry.name}`);
                return serializeCron(entry);
            } catch (error) {
                const errorMessage = toErrorMessage(error);
                log('error', `Cron execution failed (${entry.name}): ${errorMessage}`);

                if (entry.action === 'agent_prompt') {
                    queueNotification(entry, buildAgentPromptNotification(entry, {
                        status: 'error',
                        content: `Error: ${errorMessage}`,
                        error: errorMessage,
                        timedOut: false
                    }));
                }

                return null;
            }
        }
    };

    return manager;
};