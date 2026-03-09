export class InMemoryMessageStore {
    constructor() {
        this.sessions = new Map();
    }

    getOrCreateSession(sessionId) {
        const normalizedSessionId = String(sessionId || 'main');

        if (!this.sessions.has(normalizedSessionId)) {
            this.sessions.set(normalizedSessionId, {
                id: normalizedSessionId,
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        return this.sessions.get(normalizedSessionId);
    }

    appendMessage(sessionId, message) {
        const session = this.getOrCreateSession(sessionId);
        session.messages.push({ ...message });
        session.updatedAt = new Date();
        return session;
    }

    getMessages(sessionId) {
        const session = this.getOrCreateSession(sessionId);
        return [...session.messages];
    }

    clearSession(sessionId) {
        this.sessions.delete(String(sessionId || 'main'));
    }
}