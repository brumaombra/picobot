import { existsSync, mkdirSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import winston from 'winston';
import { DEFAULT_LOGS_DIR_NAME, DEFAULT_LOG_LEVEL, DEFAULT_LOG_TIMESTAMP_FORMAT, DEFAULT_LOG_MAX_SIZE, DEFAULT_ERROR_LOG_MAX_SIZE } from '../config.js';

const { combine, timestamp, printf, colorize } = winston.format;

let loggerInstance = console;
let activeLogFiles = {
    appName: 'squadforge',
    logsDir: join(process.cwd(), DEFAULT_LOGS_DIR_NAME),
    logFilePath: join(process.cwd(), DEFAULT_LOGS_DIR_NAME, 'squadforge.log'),
    errorLogFilePath: join(process.cwd(), DEFAULT_LOGS_DIR_NAME, 'squadforge-error.log')
};

const sanitizeAppName = value => {
    const normalized = String(value || 'squadforge').trim().replace(/[^a-zA-Z0-9._-]/g, '-');
    return normalized || 'squadforge';
};

const resolveDefaultAppName = rootDir => {
    const rootName = basename(rootDir || process.cwd());
    if (rootName && rootName.toLowerCase() !== 'app') {
        return rootName;
    }

    const parentName = basename(dirname(rootDir || process.cwd()));
    return parentName || 'squadforge';
};

const fileFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
});

const consoleFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${metaStr}`;
});

export const resolveLogFiles = ({ rootDir = process.cwd(), logsDir = null, appName = null } = {}) => {
    const resolvedAppName = sanitizeAppName(appName || resolveDefaultAppName(rootDir));
    const resolvedLogsDir = logsDir || join(rootDir, DEFAULT_LOGS_DIR_NAME);

    return {
        appName: resolvedAppName,
        logsDir: resolvedLogsDir,
        logFilePath: join(resolvedLogsDir, `${resolvedAppName}.log`),
        errorLogFilePath: join(resolvedLogsDir, `${resolvedAppName}-error.log`)
    };
};

const createProxyLogger = targetLogger => ({
    debug: (message, meta) => targetLogger.debug(message, meta),
    info: (message, meta) => targetLogger.info(message, meta),
    warn: (message, meta) => targetLogger.warn(message, meta),
    error: (message, meta) => targetLogger.error(message, meta)
});

export const initializeLogger = ({ rootDir = process.cwd(), logsDir = null, appName = null, level = DEFAULT_LOG_LEVEL, logger = null } = {}) => {
    activeLogFiles = resolveLogFiles({ rootDir, logsDir, appName });

    if (logger) {
        loggerInstance = logger;
        return loggerInstance;
    }

    if (!existsSync(activeLogFiles.logsDir)) {
        mkdirSync(activeLogFiles.logsDir, { recursive: true });
    }

    const targetLogger = winston.createLogger({
        level,
        format: combine(timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), fileFormat),
        transports: [
            new winston.transports.Console({
                format: combine(colorize({ all: true }), timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), consoleFormat)
            }),
            new winston.transports.File({
                filename: activeLogFiles.logFilePath,
                maxsize: DEFAULT_LOG_MAX_SIZE,
                format: combine(timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), fileFormat)
            }),
            new winston.transports.File({
                filename: activeLogFiles.errorLogFilePath,
                level: 'error',
                maxsize: DEFAULT_ERROR_LOG_MAX_SIZE,
                format: combine(timestamp({ format: DEFAULT_LOG_TIMESTAMP_FORMAT }), fileFormat)
            })
        ]
    });

    loggerInstance = createProxyLogger(targetLogger);
    loggerInstance.info(`Logger initialized at level: ${level}`);
    return loggerInstance;
};

export const getLogger = () => loggerInstance;

export const getLogFiles = () => ({ ...activeLogFiles });

export const readLogTail = ({ filePath, lines = 80 } = {}) => {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('readLogTail requires a filePath string.');
    }

    if (!existsSync(filePath)) {
        return '';
    }

    const content = readFileSync(filePath, 'utf-8');
    const normalizedLines = Math.max(1, Number(lines) || 80);
    return content.split(/\r?\n/).filter(Boolean).slice(-normalizedLines).join('\n');
};

export const logger = {
    debug: (message, meta) => getLogger().debug(message, meta),
    info: (message, meta) => getLogger().info(message, meta),
    warn: (message, meta) => getLogger().warn(message, meta),
    error: (message, meta) => getLogger().error(message, meta)
};