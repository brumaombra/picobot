import { join } from 'path';
import { AgentSpec } from './agent-spec.js';
import { Agent } from './agent.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadToolsFromDirectory } from '../loaders/load-tools.js';
import { InMemoryMessageStore } from '../runtime/in-memory-message-store.js';

const DEFAULT_LEADER_SESSION_ID = 'leader';
const LEADER_SPEC_ID = 'leader';

export class Squad {
    constructor({ agentsSpecs = new Map(), tools = new Map(), messageStore = new InMemoryMessageStore(), rootDir = null, agentsDir = null, toolsDir = null, llm = null, model = null, maxIterations = 12, onEvent = null } = {}) {
        const leaderSpec = agentsSpecs.get(LEADER_SPEC_ID);
        if (!(leaderSpec instanceof AgentSpec)) {
            throw new Error(`Squad requires a leader spec with id "${LEADER_SPEC_ID}".`);
        }

        this.agentsSpecs = agentsSpecs;
        this.tools = tools;
        this.messageStore = messageStore;
        this.rootDir = rootDir;
        this.agentsDir = agentsDir;
        this.toolsDir = toolsDir;
        this.llm = llm;
        this.model = model;
        this.maxIterations = maxIterations;
        this.onEvent = onEvent;
        this.leaderAgent = new Agent({
            id: 'leader',
            definition: leaderSpec,
            squad: this,
            sessionId: DEFAULT_LEADER_SESSION_ID
        });
    }

    static async assemble({ rootDir, agentsDir = null, toolsDir = null, messageStore = new InMemoryMessageStore(), llm = null, model = null, maxIterations = 12, onEvent = null } = {}) {
        const resolvedRootDir = rootDir || process.cwd();
        const resolvedAgentsDir = agentsDir || join(resolvedRootDir, 'agents');
        const resolvedToolsDir = toolsDir || join(resolvedRootDir, 'tools');
        const tools = await loadToolsFromDirectory({
            toolsDir: resolvedToolsDir
        });
        const { agentsSpecs } = loadAgentsFromDirectory({
            agentsDir: resolvedAgentsDir,
            availableTools: tools
        });

        return new Squad({
            agentsSpecs,
            tools,
            messageStore,
            rootDir: resolvedRootDir,
            agentsDir: resolvedAgentsDir,
            toolsDir: resolvedToolsDir,
            llm,
            model,
            maxIterations,
            onEvent
        });
    }

    emitEvent(event) {
        if (typeof this.onEvent !== 'function') {
            return;
        }

        this.onEvent(event);
    }

    getLeaderAgent() {
        return this.leaderAgent;
    }

    getLeaderSpec() {
        return this.agentsSpecs.get(LEADER_SPEC_ID) || null;
    }

    getAgentSpec(id) {
        return this.agentsSpecs.get(String(id)) || null;
    }

    listAgentSpecs() {
        return [...this.agentsSpecs.values()];
    }

    getSubagentSpec(id) {
        const normalizedId = String(id);
        if (normalizedId === LEADER_SPEC_ID) {
            return null;
        }

        return this.getAgentSpec(normalizedId);
    }

    listSubagentSpecs() {
        return this.listAgentSpecs().filter(agentSpec => agentSpec.id !== LEADER_SPEC_ID);
    }

    getTool(name) {
        return this.tools.get(String(name));
    }

    listTools() {
        return [...this.tools.values()];
    }

    listBuiltInTools(agent) {
        const availableSubagents = this.listSubagentSpecs();
        if (availableSubagents.length === 0) {
            return [];
        }

        return [{
            name: 'delegate_to_agent',
            description: `Delegate work to a specialized agent and wait for its final response. Available agents: ${availableSubagents.map(spec => spec.id).join(', ')}`,
            parameters: {
                type: 'object',
                properties: {
                    agentId: {
                        type: 'string',
                        description: 'The id of the specialized agent to run.'
                    },
                    prompt: {
                        type: 'string',
                        description: 'The task to delegate to the specialized agent.'
                    }
                },
                required: ['agentId', 'prompt']
            },
            execute: async ({ agentId, prompt }) => {
                const childAgent = agent.spawnSubagent(agentId, {
                    prompt
                });
                const result = await childAgent.run();

                return {
                    agentId: childAgent.id,
                    sessionId: childAgent.sessionId,
                    response: result.response
                };
            }
        }];
    }

    getBuiltInTool(name, agent) {
        return this.listBuiltInTools(agent).find(tool => tool.name === String(name)) || null;
    }

    getMessages(sessionId = DEFAULT_LEADER_SESSION_ID) {
        return this.requireAgentBySessionId(sessionId).getMessages();
    }

    ensureLeaderSession() {
        return this.leaderAgent.ensureSession();
    }

    async send(content, { sessionId = DEFAULT_LEADER_SESSION_ID, role = 'user' } = {}) {
        return this.requireAgentBySessionId(sessionId).send(content, { role });
    }

    spawnSubagent(type, { prompt = '', parentSessionId = DEFAULT_LEADER_SESSION_ID } = {}) {
        return this.requireAgentBySessionId(parentSessionId).spawnSubagent(type, { prompt });
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

    requireAgentBySessionId(sessionId) {
        const agent = this.findAgentBySessionId(sessionId);
        if (!agent) {
            throw new Error(`Unknown session "${sessionId}".`);
        }

        return agent;
    }
}