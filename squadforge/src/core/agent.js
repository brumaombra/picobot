import { join } from 'path';
import { AgentDefinition } from './agent-definition.js';
import { SubagentInstance } from './subagent-instance.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadToolsFromDirectory } from '../loaders/load-tools.js';
import { InMemoryMessageStore } from '../runtime/in-memory-message-store.js';

const DEFAULT_MAIN_SESSION_ID = 'main';

const createRuntimeId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export class Agent {
    constructor({ mainAgent, subagents = new Map(), tools = new Map(), messageStore = new InMemoryMessageStore(), rootDir = null, agentsDir = null, toolsDir = null, llm = null } = {}) {
        if (!(mainAgent instanceof AgentDefinition)) {
            throw new Error('Agent requires a mainAgent definition.');
        }

        this.mainAgent = mainAgent;
        this.subagents = subagents instanceof Map ? subagents : new Map(subagents);
        this.tools = tools instanceof Map ? tools : new Map(tools);
        this.messageStore = messageStore;
        this.rootDir = rootDir;
        this.agentsDir = agentsDir;
        this.toolsDir = toolsDir;
        this.llm = llm;

        this.subagentInstances = new Map();
    }

    static async fromDirectory({ rootDir, agentsDir = null, toolsDir = null, messageStore = new InMemoryMessageStore(), llm = null } = {}) {
        if (!rootDir && !agentsDir) {
            throw new Error('rootDir or agentsDir is required.');
        }

        const resolvedAgentsDir = agentsDir || join(rootDir, 'agents');
        const resolvedToolsDir = toolsDir || join(rootDir, 'tools');
        const { mainAgent, subagents } = loadAgentsFromDirectory(resolvedAgentsDir);
        const tools = await loadToolsFromDirectory(resolvedToolsDir);

        return new Agent({
            mainAgent,
            subagents,
            tools,
            messageStore,
            rootDir,
            agentsDir: resolvedAgentsDir,
            toolsDir: resolvedToolsDir,
            llm
        });
    }

    getMainAgent() {
        return this.mainAgent;
    }

    getSubagent(id) {
        return this.subagents.get(String(id));
    }

    listSubagents() {
        return [...this.subagents.values()];
    }

    getTool(name) {
        return this.tools.get(String(name));
    }

    listTools() {
        return [...this.tools.values()];
    }

    getMessages(sessionId = DEFAULT_MAIN_SESSION_ID) {
        return this.messageStore.getMessages(sessionId);
    }

    ensureMainSession(sessionId = DEFAULT_MAIN_SESSION_ID) {
        const messages = this.messageStore.getMessages(sessionId);
        if (messages.length === 0) {
            this.messageStore.appendMessage(sessionId, {
                role: 'system',
                content: this.mainAgent.prompt
            });
        }

        return this.messageStore.getOrCreateSession(sessionId);
    }

    async send(content, { sessionId = DEFAULT_MAIN_SESSION_ID, role = 'user' } = {}) {
        this.ensureMainSession(sessionId);
        this.messageStore.appendMessage(sessionId, {
            role,
            content: String(content || '')
        });

        return {
            sessionId,
            messages: this.messageStore.getMessages(sessionId)
        };
    }

    spawnSubagent(type, { prompt = '', parentSessionId = DEFAULT_MAIN_SESSION_ID } = {}) {
        const definition = this.getSubagent(type);
        if (!definition) {
            const available = [...this.subagents.keys()].join(', ');
            throw new Error(`Unknown subagent "${type}". Available subagents: ${available}`);
        }

        const instance = new SubagentInstance({
            id: createRuntimeId(definition.id),
            definition,
            prompt,
            parentSessionId
        });

        this.subagentInstances.set(instance.id, instance);
        this.messageStore.appendMessage(instance.sessionId, {
            role: 'system',
            content: definition.prompt
        });

        if (prompt) {
            this.messageStore.appendMessage(instance.sessionId, {
                role: 'user',
                content: String(prompt)
            });
        }

        return instance;
    }

    getSubagentInstance(instanceId) {
        return this.subagentInstances.get(String(instanceId));
    }

    listRunningSubagents() {
        return [...this.subagentInstances.values()];
    }
}