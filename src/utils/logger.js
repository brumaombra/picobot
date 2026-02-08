import winston from 'winston';
import { getConfigValue } from '../config/config.js';
import { DEFAULT_LOG_LEVEL, LOG_TIMESTAMP_FORMAT, LOG_FILENAME, LOG_MAX_SIZE, ERROR_LOG_FILENAME, ERROR_LOG_MAX_SIZE } from '../config.js';

// Destructure format components
const { combine, timestamp, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${metaStr}`;
});

// Logger instance
let loggerInstance = null;

// Initialize the logger with specified level
export const initLogger = () => {
    // Get log level from config
    const level = getConfigValue('logLevel') || DEFAULT_LOG_LEVEL;

    // Create the logger instance
    loggerInstance = winston.createLogger({
        level: level,
        format: combine(timestamp({ format: LOG_TIMESTAMP_FORMAT }), consoleFormat),
        transports: [
            // Console transport for real-time output
            new winston.transports.Console({
                format: combine(
                    colorize({ all: true }),
                    timestamp({ format: LOG_TIMESTAMP_FORMAT }),
                    consoleFormat
                )
            }),

            // File transport for all logs
            new winston.transports.File({
                filename: LOG_FILENAME,
                maxsize: LOG_MAX_SIZE,
                format: combine(
                    timestamp({ format: LOG_TIMESTAMP_FORMAT }),
                    printf(({ level, message, timestamp: ts, ...meta }) => {
                        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                        return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
                    })
                )
            }),

            // Separate error log file
            new winston.transports.File({
                filename: ERROR_LOG_FILENAME,
                level: 'error',
                maxsize: ERROR_LOG_MAX_SIZE,
                format: combine(
                    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                    printf(({ level, message, timestamp: ts, ...meta }) => {
                        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                        return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
                    })
                )
            })
        ]
    });

    // Log initialization
    loggerInstance.info(`Logger initialized at level: ${level}`);
};

// Export logger object for compatibility
export const logger = {
    // Log an info message
    info: (message, meta) => {
        loggerInstance.info(message, meta);
    },

    // Log a warning message
    warn: (message, meta) => {
        loggerInstance.warn(message, meta);
    },

    // Log an error message
    error: (message, meta) => {
        loggerInstance.error(message, meta);
    },

    // Log a debug message
    debug: (message, meta) => {
        loggerInstance.debug(message, meta);
    }
};