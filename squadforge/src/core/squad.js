import { join } from 'path';
import { AgentSpec } from './agent-spec.js';
import { Agent } from './agent.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadToolsFromDirectory } from '../loaders/load-tools.js';
import { InMemoryMessageStore } from '../runtime/in-memory-message-store.js';

const DEFAULT_LEADER_SESSION_ID = 'main';

export class Squad {
    constructor({ leaderSpec, subagentSpecs = new Map(), tools = new Map(), messageStore = new InMemoryMessageStore(), rootDir = null, agentsDir = null, toolsDir = null, llm = null } = {}) {
        if (!(leaderSpec instanceof AgentSpec)) {
            throw new Error('Squad requires a leaderSpec.');
        }

        this.leaderSpec = leaderSpec;
        this.subagentSpecs = subagentSpecs instanceof Map ? subagentSpecs : new Map(subagentSpecs);
        this.tools = tools instanceof Map ? tools : new Map(tools);
        this.messageStore = messageStore;
        this.rootDir = rootDir;
        this.agentsDir = agentsDir;
        this.toolsDir = toolsDir;
        this.llm = llm;

        this.leaderAgent = new Agent({
            id: 'leader',
            definition: this.leaderSpec,
            squad: this,
            sessionId: DEFAULT_LEADER_SESSION_ID
        });
    }

    static async assemble({ rootDir, agentsDir = null, toolsDir = null, messageStore = new InMemoryMessageStore(), llm = null } = {}) {
        const resolvedRootDir = rootDir || process.cwd();
        const resolvedAgentsDir = agentsDir || join(resolvedRootDir, 'agents');
        const resolvedToolsDir = toolsDir || join(resolvedRootDir, 'tools');
        const tools = await loadToolsFromDirectory({
            toolsDir: resolvedToolsDir
        });
        const { leaderAgent, subagents } = loadAgentsFromDirectory({
            agentsDir: resolvedAgentsDir,
            availableTools: tools
        });

        return new Squad({
            leaderSpec: leaderAgent,
            subagentSpecs: subagents,
            tools,
            messageStore,
            rootDir: resolvedRootDir,
            agentsDir: resolvedAgentsDir,
            toolsDir: resolvedToolsDir,
            llm
        });
    }

    getLeaderAgent() {
        return this.leaderAgent;
    }

    getSubagentSpec(id) {
        return this.subagentSpecs.get(String(id));
    }

    listSubagentSpecs() {
        return [...this.subagentSpecs.values()];
    }

    getTool(name) {
        return this.tools.get(String(name));
    }

    listTools() {
        return [...this.tools.values()];
    }

    getMessages(sessionId = DEFAULT_LEADER_SESSION_ID) {
        return this.messageStore.getMessages(sessionId);
    }

    ensureLeaderSession(sessionId = DEFAULT_LEADER_SESSION_ID) {
        if (sessionId !== DEFAULT_LEADER_SESSION_ID) {
            return this.messageStore.getOrCreateSession(sessionId);
        }

        return this.leaderAgent.ensureSession();
    }

    async send(content, { sessionId = DEFAULT_LEADER_SESSION_ID, role = 'user' } = {}) {
        if (sessionId !== DEFAULT_LEADER_SESSION_ID) {
            const agent = this.leaderAgent.findBySessionId(sessionId);
            if (!agent) {
                throw new Error(`Unknown session "${sessionId}".`);
            }

            return agent.send(content, { role });
        }

        return this.leaderAgent.send(content, { role });
    }

    spawnSubagent(type, { prompt = '', parentSessionId = DEFAULT_LEADER_SESSION_ID } = {}) {
        const parentAgent = this.leaderAgent.findBySessionId(parentSessionId);
        if (!parentAgent) {
            throw new Error(`Unknown parent session "${parentSessionId}".`);
        }

        return parentAgent.spawnSubagent(type, { prompt });
    }

    getAgent(agentId) {
        return this.findAgentById(agentId);
    }

    listRunningSubagents() {
        return this.leaderAgent.listDescendants();
    }

    findAgentById(agentId) {
        return this.leaderAgent.findById(agentId);
    }

    findAgentBySessionId(sessionId) {
        return this.leaderAgent.findBySessionId(sessionId);
    }
}