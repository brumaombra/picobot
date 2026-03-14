import { DONE_STATUS, FAILED_STATUS, RUNNING_STATUS } from '../config.js';

// Compact in-memory registry of background subagents and pending main-agent questions
export class SubagentRegistry {
    // Constructor
    constructor() {
        this.subagents = new Map();
        this.pendingQuestions = new Map();
    }

    // Register a new subagent instance
    register(id, data = {}) {
        this.subagents.set(id, {
            ...data,
            status: RUNNING_STATUS,
            result: null,
            error: null,
            startedAt: Date.now(),
            completedAt: null
        });
    }

    // Mark a subagent as running again after it has been resumed
    resume(id) {
        this.update(id, {
            status: RUNNING_STATUS,
            result: null,
            error: null,
            completedAt: null
        });
    }

    // Mark a subagent as done
    done(id, result) {
        this.update(id, {
            status: DONE_STATUS,
            result,
            error: null,
            completedAt: Date.now()
        });
    }

    // Mark a subagent as failed
    fail(id, error) {
        this.update(id, {
            status: FAILED_STATUS,
            result: null,
            error,
            completedAt: Date.now()
        });
    }

    // Get a subagent entry by id
    get(id) {
        return this.subagents.get(id) || null;
    }

    // List active subagents, optionally scoped to one parent session tree
    listActive({ parentSessionId = null } = {}) {
        return [...this.subagents.entries()]
            .filter(([, subagent]) => subagent.status === RUNNING_STATUS)
            .filter(([, subagent]) => !parentSessionId || subagent.parentSessionId === parentSessionId)
            .map(([subagentId, subagent]) => ({
                subagent_id: subagentId,
                type: subagent.type,
                name: subagent.name,
                status: subagent.status,
                startedAt: subagent.startedAt
            }));
    }

    // Register a pending question from a subagent waiting for a main-agent reply
    registerQuestion(id, resolve, reject) {
        this.pendingQuestions.set(id, { resolve, reject });
    }

    // Get a pending question resolver pair for a subagent
    getPendingQuestion(id) {
        return this.pendingQuestions.get(id) || null;
    }

    // Clear a pending question once it has been answered or rejected
    clearQuestion(id) {
        this.pendingQuestions.delete(id);
    }

    // Update a stored subagent entry when it exists
    update(id, fields = {}) {
        const subagent = this.subagents.get(id);
        if (!subagent) {
            return null;
        }

        Object.assign(subagent, fields);
        return subagent;
    }
}