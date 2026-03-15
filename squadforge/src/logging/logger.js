import { existsSync, mkdirSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import winston from 'winston';
import { DEFAULT_LOGS_DIR_NAME, DEFAULT_LOG_LEVEL, DEFAULT_LOG_TIMESTAMP_FORMAT, DEFAULT_LOG_MAX_SIZE, DEFAULT_ERROR_LOG_MAX_SIZE } from '../config.js';

const { combine, timestamp, printf, colorize } = winston.format;

// Keep the active process-wide logger instance
let loggerInstance = console;

// Keep the active log file locations for the current process
let activeLogFiles = {
    appName: 'squadforge',
    logsDir: join(process.cwd(), DEFAULT_LOGS_DIR_NAME),
    logFilePath: join(process.cwd(), DEFAULT_LOGS_DIR_NAME, 'squadforge.log'),
    errorLogFilePath: join(process.cwd(), DEFAULT_LOGS_DIR_NAME, 'squadforge-error.log')
};

// Sanitize the app name so it is safe for log file names
const sanitizeAppName = value => {
    // Normalize the value into a filesystem-safe string
    const normalized = String(value || 'squadforge').trim().replace(/[^a-zA-Z0-9._-]/g, '-');
    return normalized || 'squadforge';
};

// Resolve the default app name from the runtime root directory
const resolveDefaultAppName = rootDir => {
    // Prefer the current root directory name when it is meaningful
    const rootName = basename(rootDir || process.cwd());
    if (rootName && rootName.toLowerCase() !== 'app') {
        return rootName;
    }

    // Fall back to the parent directory name when needed
    const parentName = basename(dirname(rootDir || process.cwd()));
    return parentName || 'squadforge';
};

// Format one log line for file transports
const fileFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    // Append metadata when present
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
});

// Format one log line for the console transport
const consoleFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    // Append metadata when present
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${metaStr}`;
});

// Create the Winston logger used for process-wide logging
const createWinstonLogger = ({ level, logFilePath, errorLogFilePath } = {}) => {
    // Build the logger with console and file transports
    return winston.createLogger({
        level,
        format: combine(timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), fileFormat),
        transports: [
            new winston.transports.Console({
                format: combine(colorize({ all: true }), timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), consoleFormat)
            }),
            new winston.transports.File({
                filename: logFilePath,
                maxsize: DEFAULT_LOG_MAX_SIZE,
                format: combine(timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), fileFormat)
            }),
            new winston.transports.File({
                filename: errorLogFilePath,
                level: 'error',
                maxsize: DEFAULT_ERROR_LOG_MAX_SIZE,
                format: combine(timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), fileFormat)
            })
        ]
    });
};

// Resolve the active log file paths for the current runtime
export const resolveLogFiles = ({ rootDir = process.cwd(), logsDir = null, appName = null } = {}) => {
    // Resolve the app and logs directory names
    const resolvedAppName = sanitizeAppName(appName || resolveDefaultAppName(rootDir));
    const resolvedLogsDir = logsDir || join(rootDir, DEFAULT_LOGS_DIR_NAME);

    // Return the full set of resolved log file paths
    return {
        appName: resolvedAppName,
        logsDir: resolvedLogsDir,
        logFilePath: join(resolvedLogsDir, `${resolvedAppName}.log`),
        errorLogFilePath: join(resolvedLogsDir, `${resolvedAppName}-error.log`)
    };
};

// Initialize the active process-wide logger instance
export const initializeLogger = ({ rootDir = process.cwd(), logsDir = null, appName = null, level = DEFAULT_LOG_LEVEL, logger: customLogger = null } = {}) => {
    // Resolve and store the active log file locations
    activeLogFiles = resolveLogFiles({ rootDir, logsDir, appName });

    // Reuse the provided logger when one is injected explicitly
    if (customLogger) {
        loggerInstance = customLogger;
        return loggerInstance;
    }

    // Ensure the logs directory exists before creating file transports
    if (!existsSync(activeLogFiles.logsDir)) {
        mkdirSync(activeLogFiles.logsDir, { recursive: true });
    }

    // Create and store the active logger instance
    loggerInstance = createWinstonLogger({
        level,
        logFilePath: activeLogFiles.logFilePath,
        errorLogFilePath: activeLogFiles.errorLogFilePath
    });

    // Log the successful initialization
    loggerInstance.info(`Logger initialized at level: ${level}`);
    return loggerInstance;
};

// Get the active process-wide logger instance
export const getLogger = () => {
    return loggerInstance;
};

// Get the active log file locations
export const getLogFiles = () => {
    return { ...activeLogFiles };
};

// Read the last lines from one log file
export const readLogTail = ({ filePath, lines = 80 } = {}) => {
    // Validate the requested file path
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('readLogTail requires a filePath string.');
    }

    // Return an empty string when the log file does not exist
    if (!existsSync(filePath)) {
        return '';
    }

    // Read and trim the file content to the requested number of lines
    const content = readFileSync(filePath, 'utf-8');
    const normalizedLines = Math.max(1, Number(lines) || 80);
    return content.split(/\r?\n/).filter(Boolean).slice(-normalizedLines).join('\n');
};

// Global logger facade that forwards to the active process-wide logger
export const logger = {
    // Write one debug log line
    debug: (message, meta) => {
        return getLogger().debug(message, meta);
    },

    // Write one info log line
    info: (message, meta) => {
        return getLogger().info(message, meta);
    },

    // Write one warning log line
    warn: (message, meta) => {
        return getLogger().warn(message, meta);
    },

    // Write one error log line
    error: (message, meta) => {
        return getLogger().error(message, meta);
    }
};