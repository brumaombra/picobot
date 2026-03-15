import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadCronsFromDirectory } from '../loaders/load-crons.js';

const toErrorMessage = error => {
    return error instanceof Error ? error.message : String(error);
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

// Create a filesystem-backed JSON store for scheduled entries.
export const createJsonFileSchedulerStore = (options = {}) => {
    const {
        directoryPath,
        logger = console
    } = options;

    if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('createJsonFileSchedulerStore requires a directoryPath string.');
    }

    const log = createLogger(logger);

    const getEntryFilePath = entryId => {
        return join(directoryPath, `${entryId}.json`);
    };

    const ensureDirectory = () => {
        if (!existsSync(directoryPath)) {
            mkdirSync(directoryPath, { recursive: true });
        }
    };

    return {
        getEntryFilePath,

        saveEntry: (entryId, entry) => {
            try {
                ensureDirectory();
                writeFileSync(getEntryFilePath(entryId), JSON.stringify(entry, null, 2));
                log('debug', `Scheduled entry saved: ${entryId}`);
            } catch (error) {
                log('error', `Failed to save scheduled entry ${entryId}: ${toErrorMessage(error)}`);
            }
        },

        deleteEntry: entryId => {
            try {
                const filePath = getEntryFilePath(entryId);
                if (existsSync(filePath)) {
                    unlinkSync(filePath);
                    log('debug', `Scheduled entry file deleted: ${entryId}`);
                }
            } catch (error) {
                log('error', `Failed to delete scheduled entry file ${entryId}: ${toErrorMessage(error)}`);
            }
        },

        loadEntries: () => {
            try {
                if (!existsSync(directoryPath)) {
                    log('debug', 'No existing scheduled entries directory found');
                    return new Map();
                }

                const entries = loadCronsFromDirectory({ cronsDir: directoryPath });

                log('info', `Loaded ${entries.size} scheduled entries from disk`);
                return entries;
            } catch (error) {
                log('error', `Failed to load scheduled entries: ${toErrorMessage(error)}`);
                return new Map();
            }
        }
    };
};