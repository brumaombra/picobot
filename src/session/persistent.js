import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { SESSIONS_DIR } from '../config.js';

// Get session file path
export const getSessionFilePath = sessionKey => {
    return join(SESSIONS_DIR, `${sessionKey}.json`);
};

// Save a single session to disk
export const saveSessionToFiles = (sessionKey, session) => {
    try {
        // Ensure directory exists
        if (!existsSync(SESSIONS_DIR)) {
            mkdirSync(SESSIONS_DIR, { recursive: true });
        }

        // Prepare session data
        const sessionData = {
            ...session,
            createdAt: session.createdAt.toISOString(),
            lastActive: session.lastActive.toISOString()
        };

        // Write to file
        const filePath = getSessionFilePath(sessionKey);
        writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
        logger.debug(`Session saved: ${sessionKey}`);
    } catch (error) {
        logger.error(`Failed to save session ${sessionKey}: ${error.message}`);
    }
};

// Delete a session file from disk
export const deleteSessionFile = sessionKey => {
    try {
        const filePath = getSessionFilePath(sessionKey);
        if (existsSync(filePath)) {
            unlinkSync(filePath);
            logger.debug(`Session file deleted: ${sessionKey}`);
        }
    } catch (error) {
        logger.error(`Failed to delete session file ${sessionKey}: ${error.message}`);
    }
};

// Load all sessions from disk
export const loadSessionsFromFiles = () => {
    const sessionsMap = new Map();

    try {
        // Check if sessions directory exists
        if (!existsSync(SESSIONS_DIR)) {
            logger.debug('No existing sessions directory found');
            return sessionsMap;
        }

        // Read all JSON files from sessions directory
        const files = readdirSync(SESSIONS_DIR).filter(file => file.endsWith('.json'));
        for (const file of files) {
            try {
                // Read and parse session file
                const filePath = join(SESSIONS_DIR, file);
                const content = readFileSync(filePath, 'utf-8');
                const sessionData = JSON.parse(content);

                // Restore session with Date objects
                const session = {
                    ...sessionData,
                    createdAt: new Date(sessionData.createdAt),
                    lastActive: new Date(sessionData.lastActive)
                };

                // Add to sessions map
                sessionsMap.set(session.id, session);
            } catch (error) {
                logger.error(`Failed to load session file ${file}: ${error.message}`);
            }
        }

        // Log number of loaded sessions
        logger.info(`Loaded ${sessionsMap.size} sessions from disk`);
    } catch (error) {
        logger.error(`Failed to load sessions: ${error.message}`);
    }

    // Return the map of sessions
    return sessionsMap;
};