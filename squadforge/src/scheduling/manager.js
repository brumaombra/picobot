import cron from 'node-cron';
import { queueRuntimeMessage } from '../runtime/channel.js';
import { sendToSession } from '../runtime/lookup.js';
import { generateId, stringifyJson } from '../utils/utils.js';

const ALLOWED_SCHEDULE_ACTIONS = new Set(['message', 'agent_prompt']);

// Convert any thrown value into a readable error message.
const toErrorMessage = error => {
    return error instanceof Error ? error.message : String(error);
};

// Stop and destroy one cron task when present.
const stopTask = task => {
    task?.stop?.();
    task?.destroy?.();
};

// Remove runtime-only task state before serialization.
const stripTask = entry => {
    const { task, ...data } = entry || {};
    return data;
};

// Create a framework-owned scheduler manager with injected persistence and notification hooks.
export const createSchedulerManager = (options = {}) => {
    const {
        logger = console,
        createEntryId = () => generateId('schedule'),
        createIsolatedSessionId = () => generateId('schedule'),
        loadEntries = () => new Map(),
        saveEntry = () => { },
        deleteEntry = () => { },
        hydrateEntry = entry => entry,
        serializeEntry = stripTask,
        buildMessageNotification = entry => entry.message,
        buildAgentPromptNotification = (entry, result) => ({
            type: 'scheduled_notification',
            action: entry.action,
            scheduleId: entry.id,
            status: result.status,
            content: result.content
        })
    } = options;

    const entries = new Map();
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

    const validateEntry = entry => {
        if (!entry?.id || typeof entry.id !== 'string') {
            throw new Error('Scheduled entry requires a string id.');
        }

        if (!entry?.name || typeof entry.name !== 'string') {
            throw new Error('Scheduled entry requires a name.');
        }

        if (!entry?.sessionId || typeof entry.sessionId !== 'string') {
            throw new Error('Scheduled entry requires a sessionId.');
        }

        if (!entry?.message || typeof entry.message !== 'string') {
            throw new Error('Scheduled entry requires a message.');
        }

        if (!entry?.action || !ALLOWED_SCHEDULE_ACTIONS.has(entry.action)) {
            throw new Error(`Scheduled entry action must be one of: ${[...ALLOWED_SCHEDULE_ACTIONS].join(', ')}`);
        }

        if (!entry?.schedule || typeof entry.schedule !== 'string' || !cron.validate(entry.schedule)) {
            throw new Error(`Invalid cron schedule: ${entry?.schedule}`);
        }
    };

    const scheduleEntryTask = entry => {
        entry.task = cron.schedule(entry.schedule, async () => {
            await manager.executeEntry(entry.id);
        });

        return entry;
    };

    const clearEntries = () => {
        for (const entry of entries.values()) {
            try {
                stopTask(entry.task);
            } catch (error) {
                log('warn', `Failed to stop scheduled entry ${entry.id}: ${toErrorMessage(error)}`);
            }
        }

        entries.clear();
    };

    const queueNotification = (entry, payload) => {
        if (!runtimeAgent?.runtime) {
            log('error', `Cannot queue scheduled notification for "${entry.name}": runtime agent not set`);
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
        entries,

        setRuntimeAgent: agent => {
            runtimeAgent = agent;
            log('debug', 'Runtime agent reference set for scheduler manager');
            return manager;
        },

        serializeEntry: entry => serializeEntry(entry),

        initialize: () => {
            clearEntries();

            try {
                const loadedEntries = loadEntries() || new Map();
                for (const [entryId, rawEntry] of loadedEntries) {
                    try {
                        const entry = hydrateEntry({
                            ...rawEntry,
                            id: rawEntry?.id || entryId,
                            task: null
                        });

                        validateEntry(entry);
                        scheduleEntryTask(entry);
                        entries.set(entry.id, entry);
                        log('info', `Scheduled entry loaded: ${entry.name} (${entry.schedule})`);
                    } catch (error) {
                        log('error', `Failed to load scheduled entry ${entryId}: ${toErrorMessage(error)}`);
                    }
                }

                log('info', `Scheduler manager initialized with ${entries.size} entries`);
            } catch (error) {
                log('error', `Failed to initialize scheduler manager: ${toErrorMessage(error)}`);
            }

            return entries;
        },

        stop: () => {
            clearEntries();
            log('info', 'Scheduler manager stopped');
        },

        getEntry: id => {
            return entries.get(id) || null;
        },

        listEntries: () => {
            return [...entries.values()].map(entry => serializeEntry(entry));
        },

        createEntry: input => {
            const entry = hydrateEntry({
                ...input,
                id: input?.id || createEntryId(),
                task: null
            });

            validateEntry(entry);
            scheduleEntryTask(entry);
            entries.set(entry.id, entry);
            saveEntry(entry.id, serializeEntry(entry));
            log('info', `Created scheduled entry: ${entry.name} (${entry.schedule})`);

            return serializeEntry(entry);
        },

        updateEntry: (id, updates = {}) => {
            const currentEntry = entries.get(id);
            if (!currentEntry) {
                throw new Error(`Scheduled entry not found: ${id}`);
            }

            const nextEntry = hydrateEntry({
                ...stripTask(currentEntry),
                ...updates,
                id,
                task: null
            });

            validateEntry(nextEntry);
            stopTask(currentEntry.task);
            scheduleEntryTask(nextEntry);
            entries.set(id, nextEntry);
            saveEntry(id, serializeEntry(nextEntry));
            log('info', `Updated scheduled entry: ${nextEntry.name}`);

            return serializeEntry(nextEntry);
        },

        deleteEntry: id => {
            const entry = entries.get(id);
            if (!entry) {
                throw new Error(`Scheduled entry not found: ${id}`);
            }

            stopTask(entry.task);
            entries.delete(id);
            deleteEntry(id);
            log('info', `Deleted scheduled entry: ${entry.name}`);

            return serializeEntry(entry);
        },

        executeEntry: async id => {
            const entry = entries.get(id);
            if (!entry) {
                log('error', `Scheduled entry not found: ${id}`);
                return null;
            }

            log('info', `Executing scheduled entry: ${entry.name}`);

            try {
                if (entry.action === 'message') {
                    queueNotification(entry, buildMessageNotification(entry));
                    log('info', `Scheduled entry completed: ${entry.name}`);
                    return serializeEntry(entry);
                }

                if (!runtimeAgent?.runtime) {
                    log('error', `Cannot execute scheduled agent prompt "${entry.name}": runtime agent not set`);
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

                log('info', `Scheduled entry completed: ${entry.name}`);
                return serializeEntry(entry);
            } catch (error) {
                const errorMessage = toErrorMessage(error);
                log('error', `Scheduled entry execution failed (${entry.name}): ${errorMessage}`);

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