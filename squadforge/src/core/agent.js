import { AgentSpec } from './agent-spec.js';

const RUNNING_STATUS = 'running';
const IDLE_STATUS = 'idle';

const createRuntimeId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export class Agent {
    constructor({ id = null, definition, squad, parent = null, sessionId = null, initialPrompt = '' } = {}) {
        if (!(definition instanceof AgentSpec)) {
            throw new Error('Agent requires an AgentSpec.');
        }

        if (!squad) {
            throw new Error('Agent requires a squad instance.');
        }

        this.id = String(id || createRuntimeId(definition.id));
        this.definition = definition;
        this.squad = squad;
        this.parent = parent;
        this.sessionId = String(sessionId || this.id);
        this.initialPrompt = String(initialPrompt || '');
        this.status = IDLE_STATUS;
        this.startedAt = new Date();
        this.completedAt = null;
        this.result = null;
        this.error = null;
        this.subagents = new Map();
    }

    get name() {
        return this.definition.name;
    }

    get prompt() {
        return this.definition.prompt;
    }

    get allowedToolNames() {
        return [...this.definition.allowedTools];
    }

    getMessages() {
        return this.squad.messageStore.getMessages(this.sessionId);
    }

    ensureSession() {
        const messages = this.getMessages();
        if (messages.length === 0) {
            this.squad.messageStore.appendMessage(this.sessionId, {
                role: 'system',
                content: this.prompt
            });

            if (this.initialPrompt) {
                this.squad.messageStore.appendMessage(this.sessionId, {
                    role: 'user',
                    content: this.initialPrompt
                });
            }
        }

        return this.squad.messageStore.getOrCreateSession(this.sessionId);
    }

    async send(content, { role = 'user' } = {}) {
        this.ensureSession();
        this.status = RUNNING_STATUS;
        this.squad.messageStore.appendMessage(this.sessionId, {
            role,
            content: String(content || '')
        });

        return {
            agentId: this.id,
            sessionId: this.sessionId,
            messages: this.getMessages()
        };
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

    getTool(name) {
        const normalizedName = String(name);
        if (!this.definition.allowedTools.includes(normalizedName)) {
            return null;
        }

        return this.squad.getTool(normalizedName);
    }

    listTools() {
        return this.definition.allowedTools
            .map(toolName => this.squad.getTool(toolName))
            .filter(Boolean);
    }

    spawnSubagent(type, { prompt = '' } = {}) {
        const definition = this.squad.getSubagentSpec(type);
        if (!definition) {
            const available = this.squad.listSubagentSpecs().map(agent => agent.id).join(', ');
            throw new Error(`Unknown subagent "${type}". Available subagents: ${available}`);
        }

        const agent = new Agent({
            definition,
            squad: this.squad,
            parent: this,
            initialPrompt: prompt
        });

        agent.ensureSession();
        this.subagents.set(agent.id, agent);
        return agent;
    }

    getSubagent(agentId) {
        return this.subagents.get(String(agentId));
    }

    listSubagents() {
        return [...this.subagents.values()];
    }

    listDescendants() {
        const descendants = [];

        for (const agent of this.subagents.values()) {
            descendants.push(agent);
            descendants.push(...agent.listDescendants());
        }

        return descendants;
    }

    findById(agentId) {
        const normalizedId = String(agentId);
        if (this.id === normalizedId) {
            return this;
        }

        for (const agent of this.subagents.values()) {
            const match = agent.findById(normalizedId);
            if (match) {
                return match;
            }
        }

        return null;
    }

    findBySessionId(sessionId) {
        const normalizedSessionId = String(sessionId);
        if (this.sessionId === normalizedSessionId) {
            return this;
        }

        for (const agent of this.subagents.values()) {
            const match = agent.findBySessionId(normalizedSessionId);
            if (match) {
                return match;
            }
        }

        return null;
    }
}