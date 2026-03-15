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

// Create a filesystem-backed JSON store for persisted cron definitions.
export const createJsonFileCronStore = (options = {}) => {
    const {
        directoryPath,
        logger = console
    } = options;

    if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('createJsonFileCronStore requires a directoryPath string.');
    }

    const log = createLogger(logger);

    const getCronFilePath = cronId => {
        return join(directoryPath, `${cronId}.json`);
    };

    const ensureDirectory = () => {
        if (!existsSync(directoryPath)) {
            mkdirSync(directoryPath, { recursive: true });
        }
    };

    return {
        getCronFilePath,

        saveCron: (cronId, cronEntry) => {
            try {
                ensureDirectory();
                writeFileSync(getCronFilePath(cronId), JSON.stringify(cronEntry, null, 2));
                log('debug', `Cron saved: ${cronId}`);
            } catch (error) {
                log('error', `Failed to save cron ${cronId}: ${toErrorMessage(error)}`);
            }
        },

        deleteCron: cronId => {
            try {
                const filePath = getCronFilePath(cronId);
                if (existsSync(filePath)) {
                    unlinkSync(filePath);
                    log('debug', `Cron file deleted: ${cronId}`);
                }
            } catch (error) {
                log('error', `Failed to delete cron file ${cronId}: ${toErrorMessage(error)}`);
            }
        },

        loadCrons: () => {
            try {
                if (!existsSync(directoryPath)) {
                    log('debug', 'No existing crons directory found');
                    return new Map();
                }

                const entries = loadCronsFromDirectory({ cronsDir: directoryPath });

                log('info', `Loaded ${entries.size} crons from disk`);
                return entries;
            } catch (error) {
                log('error', `Failed to load crons: ${toErrorMessage(error)}`);
                return new Map();
            }
        }
    };
};