import { logger } from '../utils/logger.js';

// Possible subagent statuses
export const SubagentStatus = {
    RUNNING: 'running',
    DONE: 'done',
    FAILED: 'failed'
};

// Compact in-memory registry of subagent instances
export class SubagentRegistry {
    // List of subagents with metadata, status, results, and errors
    #subagents = new Map();

    // Pending questions — subagents blocked waiting for a main agent reply
    #pendingQuestions = new Map();

    // Register a new subagent instance with its initial data
    register(id, data) {
        this.#subagents.set(id, {
            ...data,
            status: SubagentStatus.RUNNING,
            result: null,
            error: null,
            startedAt: Date.now(),
            completedAt: null
        });
        logger.debug(`Registered subagent ${id} (${data.name})`);
    }

    // Mark a subagent as done with its result
    done(id, result) {
        this.#update(id, { status: SubagentStatus.DONE, result, error: null });
        logger.debug(`Subagent ${id} done`);
    }

    // Mark a subagent as failed with its error
    fail(id, error) {
        this.#update(id, { status: SubagentStatus.FAILED, error, result: null });
        logger.debug(`Subagent ${id} failed: ${error}`);
    }

    // Retrieve a subagent by its ID
    get(id) {
        return this.#subagents.get(id);
    }

    // Retrieve active (running) subagents
    listActive() {
        // Get only the running subagents
        const entries = Array.from(this.#subagents.entries());
        const runningEntries = entries.filter(([, subagent]) => subagent.status === SubagentStatus.RUNNING);

        // Return simplified info for active subagents
        return runningEntries.map(([subagentId, subagent]) => ({
            subagent_id: subagentId,
            type: subagent.type,
            name: subagent.name,
            status: subagent.status,
            startedAt: subagent.startedAt
        }));
    }

    // Register a pending question from a subagent waiting for a main agent reply
    registerQuestion(id, resolve, reject) {
        this.#pendingQuestions.set(id, { resolve, reject });
        logger.debug(`Registered pending question for subagent ${id}`);
    }

    // Retrieve a pending question by subagent ID (returns undefined if none)
    getPendingQuestion(id) {
        return this.#pendingQuestions.get(id);
    }

    // Remove a pending question — called after it is resolved or rejected
    clearQuestion(id) {
        this.#pendingQuestions.delete(id);
        logger.debug(`Cleared pending question for subagent ${id}`);
    }

    // Resume a completed subagent — resets status to running so chat can re-enter its session
    resume(id) {
        // Get the subagent
        const subagent = this.#subagents.get(id);
        if (!subagent) {
            logger.warn(`Tried to resume unknown subagent ${id}`);
            return;
        }

        // Reset its status to running and clear completedAt so it can be resumed in chat
        Object.assign(subagent, { status: SubagentStatus.RUNNING, completedAt: null });
        logger.debug(`Resumed subagent ${id}`);
    }

    // Internal method to update a subagent's fields and set completedAt timestamp
    #update(id, fields) {
        const subagent = this.#subagents.get(id);
        if (!subagent) {
            logger.warn(`Tried to update unknown subagent ${id}`);
            return;
        }

        Object.assign(subagent, fields, { completedAt: Date.now() });
    }
}