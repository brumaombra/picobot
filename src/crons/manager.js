import { createJsonFileSchedulerStore, createSchedulerManager, DEFAULT_CRONS_DIR_NAME } from '../../squadforge/src/index.js';
import { join } from 'path';
import { logger } from '../utils/common/logger.js';
import { generateUniqueId } from '../utils/common/utils.js';

let runtimeAgent = null;
let cronManager = null;
let activeCronsDir = null;

const resolveCronsDir = () => {
    return runtimeAgent?.runtime?.cronsDir || join(process.cwd(), DEFAULT_CRONS_DIR_NAME);
};

const createCronManager = directoryPath => {
    const cronStore = createJsonFileSchedulerStore({
        directoryPath,
        logger
    });

    const manager = createSchedulerManager({
        logger,
        createEntryId: () => generateUniqueId('cron'),
        createIsolatedSessionId: () => generateUniqueId('cron'),
        loadEntries: cronStore.loadEntries,
        saveEntry: cronStore.saveEntry,
        deleteEntry: cronStore.deleteEntry,
        hydrateEntry: hydrateCronEntry,
        serializeEntry: serializeCron,
        buildMessageNotification: entry => ({
            type: 'cron_notification',
            action: 'message',
            cron: entry.name,
            schedule: entry.schedule,
            content: entry.message,
            instruction: 'This is a simple scheduled message. Forward this message to the user as-is.'
        }),
        buildAgentPromptNotification: (entry, result) => ({
            type: 'cron_notification',
            action: 'agent_prompt',
            cron: entry.name,
            schedule: entry.schedule,
            content: result.content,
            instruction: buildAgentPromptInstruction(result.status)
        })
    });

    if (runtimeAgent) {
        manager.setRuntimeAgent(runtimeAgent);
    }

    return manager;
};

const getCronManager = () => {
    const resolvedCronsDir = resolveCronsDir();
    if (!cronManager || activeCronsDir !== resolvedCronsDir) {
        activeCronsDir = resolvedCronsDir;
        cronManager = createCronManager(resolvedCronsDir);
    }

    return cronManager;
};

// Normalize persisted cron entries, including legacy channel/chatId records.
const hydrateCronEntry = cronEntry => {
    const sessionId = cronEntry?.sessionId || (cronEntry?.channel && cronEntry?.chatId ? `${cronEntry.channel}_${cronEntry.chatId}` : null);
    return {
        ...cronEntry,
        sessionId,
        task: null
    };
};

// Serialize cron entries for storage and tool responses.
export const serializeCron = cronEntry => {
    const { task, channel, chatId, ...data } = cronEntry || {};
    return data;
};

const buildAgentPromptInstruction = status => {
    if (status === 'timed_out') {
        return 'A scheduled agent task ran out of time before completing. Inform the user.';
    }

    if (status === 'error') {
        return 'A scheduled agent task failed. Inform the user of the error.';
    }

    return 'A scheduled agent task has completed. Relay the result to the user.';
};

// Set the agent instance used by scheduled runtime actions.
export const setCronAgent = agent => {
    runtimeAgent = agent;
    getCronManager().setRuntimeAgent(agent);
};

// Initialize cron manager - loads crons from disk and schedules them.
export const initializeCronManager = () => {
    return getCronManager().initialize();
};

// Stop all scheduled crons and clear in-memory state.
export const stopCronManager = () => {
    getCronManager().stop();
};

// Execute a cron by ID.
export const executeCron = async cronId => {
    return getCronManager().executeEntry(cronId);
};

// Create a new cron entry through the framework scheduler manager.
export const createCron = cronEntry => {
    return getCronManager().createEntry(cronEntry);
};

// Update an existing cron entry.
export const updateCron = (cronId, updates) => {
    return getCronManager().updateEntry(cronId, updates);
};

// Delete an existing cron entry.
export const deleteCron = cronId => {
    return getCronManager().deleteEntry(cronId);
};

// Get one cron entry.
export const getCron = cronId => {
    return getCronManager().getEntry(cronId);
};

// List all cron entries.
export const listCrons = () => {
    return getCronManager().listEntries();
};