// The in-memory message store class
export class InMemoryMessageStore {
    // Constructor
    constructor() {
        this.sessions = new Map();
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
        return session;
    }

    // Get all messages for a session
    getMessages(sessionId) {
        const session = this.getOrCreateSession(sessionId);
        return [...session.messages];
    }

    // Clear all messages for a session
    clearSession(sessionId) {
        this.sessions.delete(sessionId || 'leader');
    }
}