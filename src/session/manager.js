import { logger } from '../utils/logger.js';
import { saveSessionToFiles, deleteSessionFile, loadSessionsFromFiles } from './persistent.js';
import { MAX_MESSAGES_PER_SESSION, SESSION_TTL_MS } from '../config.js';

// Session manager state
let sessions = new Map();

// Initialize session manager
export const initSessionManager = () => {
    sessions = loadSessionsFromFiles();
};

// Get or create a session
export const getOrCreateSession = sessionKey => {
    // Get the session
    let session = sessions.get(sessionKey);

    // Check if session exists
    if (!session) {
        // Create new session
        session = {
            id: sessionKey,
            messages: [],
            createdAt: new Date(),
            lastActive: new Date()
        };

        // Store the new session
        sessions.set(sessionKey, session);
        logger.debug(`Created new session: ${sessionKey}`);
    }

    // Update last active time
    session.lastActive = new Date();

    // Save session to disk
    saveSessionToFiles(sessionKey, session);

    // Return the session
    return session;
};

// Add a message to a session
export const addMessageToSession = (sessionKey, message) => {
    // Add message to session
    const session = getOrCreateSession(sessionKey);
    session.messages.push(message);

    // Trim old messages if too many
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
        // Extract system messages and recent messages
        const systemMessages = session.messages.filter(message => message.role === 'system');
        const otherMessages = session.messages.filter(message => message.role !== 'system');

        // Save only the latest messages up to the limit
        const keepCount = MAX_MESSAGES_PER_SESSION - systemMessages.length;
        session.messages = [...systemMessages, ...otherMessages.slice(-keepCount)];

        // Log trimming action
        logger.debug(`Trimmed session ${sessionKey} to ${session.messages.length} messages`);
    }

    // Save session to disk
    saveSessionToFiles(sessionKey, session);
};

// Get messages for a session
export const getSessionMessages = sessionKey => {
    const session = sessions.get(sessionKey);
    return session?.messages || [];
};

// Clear a session
export const clearSession = sessionKey => {
    sessions.delete(sessionKey); // Delete session from memory
    deleteSessionFile(sessionKey); // Delete session file from disk
    logger.debug(`Cleared session: ${sessionKey}`);
};

// Clean up expired sessions
export const cleanupSessions = () => {
    const now = Date.now();
    let cleaned = 0;

    // Iterate through sessions and remove expired ones
    for (const [key, session] of sessions.entries()) {
        if (now - session.lastActive.getTime() > SESSION_TTL_MS) {
            sessions.delete(key); // Remove session from memory
            deleteSessionFile(key); // Remove session file from disk
            cleaned++;
        }
    }

    // Log cleanup result
    if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired sessions`);
    }
};

// Get all active sessions
export const getActiveSessions = () => {
    return Array.from(sessions.keys());
};