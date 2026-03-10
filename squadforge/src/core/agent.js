import { AgentSpec } from './agent-spec.js';
import { executeToolBatch } from '../tools/tool-executor.js';
import { RUNNING_STATUS, IDLE_STATUS, DONE_STATUS, FAILED_STATUS } from '../config.js';

const createRuntimeId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeAssistantContent = content => {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map(item => {
                if (typeof item === 'string') {
                    return item;
                }

                if (item?.type === 'text') {
                    return item.text || '';
                }

                return '';
            })
            .filter(Boolean)
            .join('\n');
    }

    return '';
};

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

    get model() {
        return this.definition.model || this.squad.model || null;
    }

    getMessages() {
        return this.squad.messageStore.getMessages(this.sessionId);
    }

    appendMessage(message) {
        this.squad.messageStore.appendMessage(this.sessionId, message);
        return message;
    }

    getToolDefinitions() {
        return this.listTools().map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }

    ensureSession() {
        const messages = this.getMessages();
        if (messages.length === 0) {
            this.appendMessage({
                role: 'system',
                content: this.prompt
            });

            if (this.initialPrompt) {
                this.appendMessage({
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
        this.squad.emitEvent({
            type: 'agent:message',
            agentId: this.id,
            agentType: this.definition.id,
            role,
            sessionId: this.sessionId
        });
        this.appendMessage({
            role,
            content: String(content || '')
        });

        if (!this.squad.llm) {
            return {
                agentId: this.id,
                sessionId: this.sessionId,
                response: null,
                messages: this.getMessages()
            };
        }

        const result = await this.runLoop();

        return {
            agentId: this.id,
            sessionId: this.sessionId,
            response: result.response,
            messages: this.getMessages()
        };
    }

    async runLoop() {
        const maxIterations = this.squad.maxIterations;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            this.squad.emitEvent({
                type: 'agent:iteration',
                agentId: this.id,
                agentType: this.definition.id,
                iteration: iteration + 1,
                sessionId: this.sessionId
            });

            const result = await this.squad.llm.chat(
                this.getMessages(),
                this.getToolDefinitions(),
                this.model
            );

            const content = normalizeAssistantContent(result?.content);
            const toolCalls = Array.isArray(result?.tool_calls) ? result.tool_calls : [];

            this.appendMessage({
                role: 'assistant',
                content,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined
            });

            this.squad.emitEvent({
                type: 'agent:assistant',
                agentId: this.id,
                agentType: this.definition.id,
                toolCalls: toolCalls.length,
                hasContent: Boolean(content)
            });

            if (toolCalls.length === 0) {
                this.complete(content || null);
                this.squad.emitEvent({
                    type: 'agent:complete',
                    agentId: this.id,
                    agentType: this.definition.id,
                    sessionId: this.sessionId
                });
                return {
                    response: content || null,
                    finishReason: result?.finish_reason || 'stop'
                };
            }

            const toolMessages = await executeToolBatch({
                agent: this,
                toolCalls
            });

            for (const toolMessage of toolMessages) {
                this.appendMessage(toolMessage);
            }
        }

        this.fail(`Agent loop exceeded max iterations (${maxIterations}).`);
        this.squad.emitEvent({
            type: 'agent:error',
            agentId: this.id,
            agentType: this.definition.id,
            error: `Agent loop exceeded max iterations (${maxIterations}).`
        });
        throw new Error(`Agent loop exceeded max iterations (${maxIterations}).`);
    }

    async run(input = null, options = {}) {
        if (input === null || input === undefined) {
            return this.runLoop();
        }

        return this.send(input, options);
    }

    complete(result = null) {
        this.status = DONE_STATUS;
        this.result = result;
        this.error = null;
        this.completedAt = new Date();
        return this;
    }

    fail(error) {
        this.status = FAILED_STATUS;
        this.result = null;
        this.error = error instanceof Error ? error.message : String(error);
        this.completedAt = new Date();
        return this;
    }

    getTool(name) {
        const normalizedName = String(name);
        const builtInTool = this.squad.getBuiltInTool(normalizedName, this);
        if (builtInTool) {
            return builtInTool;
        }

        if (!this.definition.allowedTools.includes(normalizedName)) {
            return null;
        }

        return this.squad.getTool(normalizedName);
    }

    listTools() {
        const externalTools = this.definition.allowedTools
            .map(toolName => this.squad.getTool(toolName))
            .filter(Boolean);

        return [...this.squad.listBuiltInTools(this), ...externalTools];
    }

    spawnSubagent(type, { prompt = '' } = {}) {
        const definition = this.squad.getAgentSpec(type);
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
        this.squad.emitEvent({
            type: 'agent:spawn',
            parentAgentId: this.id,
            parentAgentType: this.definition.id,
            agentId: agent.id,
            agentType: agent.definition.id,
            sessionId: agent.sessionId
        });
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