import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

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
        logger = console,
        fileExtension = '.json'
    } = options;

    if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('createJsonFileSchedulerStore requires a directoryPath string.');
    }

    const log = createLogger(logger);

    const getEntryFilePath = entryId => {
        return join(directoryPath, `${entryId}${fileExtension}`);
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
            const entries = new Map();

            try {
                if (!existsSync(directoryPath)) {
                    log('debug', 'No existing scheduled entries directory found');
                    return entries;
                }

                const files = readdirSync(directoryPath).filter(fileName => fileName.endsWith(fileExtension));
                for (const fileName of files) {
                    try {
                        const filePath = join(directoryPath, fileName);
                        const parsedEntry = JSON.parse(readFileSync(filePath, 'utf-8'));
                        entries.set(parsedEntry.id, parsedEntry);
                    } catch (error) {
                        log('error', `Failed to load scheduled entry file ${fileName}: ${toErrorMessage(error)}`);
                    }
                }

                log('info', `Loaded ${entries.size} scheduled entries from disk`);
            } catch (error) {
                log('error', `Failed to load scheduled entries: ${toErrorMessage(error)}`);
            }

            return entries;
        }
    };
};