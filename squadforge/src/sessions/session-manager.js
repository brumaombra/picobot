import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LEADER_SESSION_ID, DEFAULT_MAX_MESSAGES_PER_SESSION, DEFAULT_SESSIONS_DIR_NAME, DEFAULT_SESSION_TTL_MS } from '../config.js';
import { normalizeSessionId } from '../utils/utils.js';

// Session manager with optional disk persistence
export class SessionManager {
    // Constructor
    constructor({ sessionsDir = null, maxMessagesPerSession = DEFAULT_MAX_MESSAGES_PER_SESSION, sessionTtlMs = DEFAULT_SESSION_TTL_MS, sessions = null } = {}) {
        // Save the properties
        this.sessions = sessions instanceof Map ? new Map(sessions) : new Map();
        this.sessionsDir = sessionsDir;
        this.maxMessagesPerSession = maxMessagesPerSession;
        this.sessionTtlMs = sessionTtlMs;

        // Drop expired stale sessions after loading persisted state
        this.cleanupExpiredSessions();
    }

    // Get the file path for a session
    getSessionFilePath(sessionId) {
        return join(this.sessionsDir || DEFAULT_SESSIONS_DIR_NAME, `${normalizeSessionId(sessionId)}.json`);
    }

    // Ensure the sessions directory exists
    ensureSessionsDir() {
        // If no sessions directory is configured, skip creating it
        if (!this.sessionsDir) {
            return;
        }

        // Check if the sessions directory exists and create it if it doesn't
        if (!existsSync(this.sessionsDir)) {
            mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    // Trim a session to the configured maximum number of messages
    trimSession(session) {
        // If the session is within the message limit, return it as is
        if (session.messages.length <= this.maxMessagesPerSession) {
            return session;
        }

        // Keep all system messages and the newest non-system messages up to the limit
        const systemMessages = session.messages.filter(message => message.role === 'system');
        const otherMessages = session.messages.filter(message => message.role !== 'system');
        const keepCount = Math.max(0, this.maxMessagesPerSession - systemMessages.length);
        let trimmedMessages = otherMessages.slice(-keepCount);

        // Avoid starting the trimmed slice with orphaned tool results
        while (trimmedMessages.length > 0 && trimmedMessages[0].role === 'tool') {
            trimmedMessages.shift();
        }

        // Combine the system messages with the trimmed non-system messages and return the session
        session.messages = [...systemMessages, ...trimmedMessages];
        return session;
    }

    // Remove expired stale sessions from memory and disk
    cleanupExpiredSessions() {
        // If no session TTL is configured, skip cleanup
        if (!this.sessionTtlMs || this.sessionTtlMs < 1) {
            return;
        }

        // Get the current time and iterate through all sessions to find expired ones
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            // Keep the leader session alive by default
            if (sessionId === DEFAULT_LEADER_SESSION_ID) {
                continue;
            }

            // If the session's last update time is within the TTL, keep it alive
            const lastActiveAt = session.updatedAt instanceof Date ? session.updatedAt.getTime() : new Date(session.updatedAt || 0).getTime();
            if (now - lastActiveAt <= this.sessionTtlMs) {
                continue;
            }

            // Clear the expired session from memory and disk
            this.clearSession(sessionId);
        }
    }

    // Save a session to disk if persistence is enabled
    saveSession(sessionId) {
        // If no sessions directory is configured, skip saving
        if (!this.sessionsDir) {
            return;
        }

        // Get the session data to save
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        // Ensure the sessions directory exists before saving
        this.ensureSessionsDir();

        // Create the session data
        const filePath = this.getSessionFilePath(sessionId);
        const sessionData = {
            ...session,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString()
        };

        // Write the session data to a JSON file
        writeFileSync(filePath, JSON.stringify(sessionData, null, 4));
    }

    // Get or create a session by its ID
    getOrCreateSession(sessionId) {
        const normalizedSessionId = normalizeSessionId(sessionId);

        // Drop expired sessions before serving the requested one
        this.cleanupExpiredSessions();

        // If the session doesn't exist, create a new one
        if (!this.sessions.has(normalizedSessionId)) {
            this.sessions.set(normalizedSessionId, {
                id: normalizedSessionId,
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // Return the session object
        return this.sessions.get(normalizedSessionId);
    }

    // Get an existing session by its ID without creating a new one
    getSession(sessionId) {
        const normalizedSessionId = normalizeSessionId(sessionId);
        this.cleanupExpiredSessions(); // Drop expired sessions before serving the requested one
        return this.sessions.get(normalizedSessionId) || null; // Return the existing session when present
    }

    // Append a message to a session
    appendMessage(sessionId, message) {
        const session = this.getOrCreateSession(sessionId);
        session.messages.push({ ...message });
        this.trimSession(session); // Trim the session to the maximum number of messages
        session.updatedAt = new Date();
        this.saveSession(session.id); // Save the session to disk
        return session;
    }

    // Get all messages for a session
    getMessages(sessionId) {
        const session = this.getOrCreateSession(sessionId);
        return [...session.messages];
    }

    // Clear all messages for a session
    clearSession(sessionId) {
        // Delete the session from memory
        const normalizedSessionId = normalizeSessionId(sessionId);
        this.sessions.delete(normalizedSessionId);

        // If no sessions directory is configured, skip deleting from disk
        if (!this.sessionsDir) {
            return;
        }

        // Delete the session file from disk if it exists
        const filePath = this.getSessionFilePath(normalizedSessionId);
        if (existsSync(filePath)) {
            unlinkSync(filePath);
        }
    }
}