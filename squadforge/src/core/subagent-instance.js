const RUNNING_STATUS = 'running';

export class SubagentInstance {
    constructor({ id, definition, prompt = '', parentSessionId = 'main', sessionId = null } = {}) {
        if (!id) {
            throw new Error('SubagentInstance requires an id.');
        }

        if (!definition) {
            throw new Error('SubagentInstance requires an agent definition.');
        }

        this.id = String(id);
        this.definition = definition;
        this.prompt = String(prompt || '');
        this.parentSessionId = String(parentSessionId || 'main');
        this.sessionId = sessionId || this.id;
        this.status = RUNNING_STATUS;
        this.startedAt = new Date();
        this.completedAt = null;
        this.result = null;
        this.error = null;
    }

    complete(result = null) {
        this.status = 'done';
        this.result = result;
        this.error = null;
        this.completedAt = new Date();
        return this;
    }

    fail(error) {
        this.status = 'failed';
        this.result = null;
        this.error = error instanceof Error ? error.message : String(error);
        this.completedAt = new Date();
        return this;
    }
}
