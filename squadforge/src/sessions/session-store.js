import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { DEFAULT_SESSIONS_DIR_NAME } from '../config.js';

// Session store with optional disk persistence
export class SessionStore {
    // Constructor
    constructor({ sessionsDir = null } = {}) {
        // Save the properties
        this.sessions = new Map();
        this.sessionsDir = sessionsDir;

        // Load persisted sessions if a sessions directory is configured
        if (this.sessionsDir) {
            this.loadSessions();
        }
    }

    // Get the file path for a session
    getSessionFilePath(sessionId) {
        return join(this.sessionsDir || DEFAULT_SESSIONS_DIR_NAME, `${sessionId}.json`);
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

    // Load all sessions from disk
    loadSessions() {
        // If no sessions directory is configured or it doesn't exist, skip loading
        if (!this.sessionsDir || !existsSync(this.sessionsDir)) {
            return;
        }

        // Read all JSON files in the sessions directory and load them into memory
        const files = readdirSync(this.sessionsDir).filter(fileName => fileName.endsWith('.json'));
        for (const fileName of files) {
            // Get the file path and read the session data
            const filePath = join(this.sessionsDir, fileName);
            const content = readFileSync(filePath, 'utf-8');
            const sessionData = JSON.parse(content);
            const sessionId = sessionData.id || basename(fileName, '.json');

            // Save the session data in memory
            this.sessions.set(sessionId, {
                ...sessionData,
                id: sessionId,
                createdAt: sessionData.createdAt ? new Date(sessionData.createdAt) : new Date(),
                updatedAt: sessionData.updatedAt ? new Date(sessionData.updatedAt) : new Date(),
                messages: Array.isArray(sessionData.messages) ? sessionData.messages : []
            });
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
        const normalizedSessionId = sessionId || 'leader';

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

    // Append a message to a session
    appendMessage(sessionId, message) {
        const session = this.getOrCreateSession(sessionId);
        session.messages.push({ ...message });
        session.updatedAt = new Date();
        this.saveSession(session.id);
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
        const normalizedSessionId = sessionId || 'leader';
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