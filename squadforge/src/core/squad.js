import { join } from 'path';
import { AgentSpec } from './agent-spec.js';
import { Agent } from './agent.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadToolsFromDirectory } from '../loaders/load-tools.js';
import { InMemoryMessageStore } from '../runtime/in-memory-message-store.js';
import { DEFAULT_AGENTS_DIR_NAME, DEFAULT_TOOLS_DIR_NAME, DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID, DEFAULT_MAX_ITERATIONS } from '../config.js';
import { getPredefinedTool, listPredefinedTools } from '../tools/tools.js';

// Squad class
export class Squad {
    // Constructor
    constructor({ agentsSpecs = new Map(), tools = new Map(), messageStore = new InMemoryMessageStore(), rootDir = null, agentsDir = null, toolsDir = null, llm = null, model = null, maxIterations = DEFAULT_MAX_ITERATIONS, onEvent = null } = {}) {
        // Validate that the leader spec is present
        const leaderSpec = agentsSpecs.get(LEADER_SPEC_ID);
        if (!(leaderSpec instanceof AgentSpec)) {
            throw new Error(`Squad requires a leader spec with id "${LEADER_SPEC_ID}".`);
        }

        // Initialize properties
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
            id: LEADER_SPEC_ID,
            definition: leaderSpec,
            squad: this,
            sessionId: DEFAULT_LEADER_SESSION_ID
        });
    }

    // Main method to assemble the squad
    static async assemble({ rootDir, agentsDir = null, toolsDir = null, messageStore = new InMemoryMessageStore(), llm = null, model = null, maxIterations = DEFAULT_MAX_ITERATIONS, onEvent = null } = {}) {
        // Resolve directories
        const resolvedRootDir = rootDir || process.cwd();
        const resolvedAgentsDir = agentsDir || join(resolvedRootDir, DEFAULT_AGENTS_DIR_NAME);
        const resolvedToolsDir = toolsDir || join(resolvedRootDir, DEFAULT_TOOLS_DIR_NAME);

        // Load the tools and agent specs and validate them
        const tools = await loadToolsFromDirectory({ toolsDir: resolvedToolsDir });
        const agentsSpecs = loadAgentsFromDirectory({ agentsDir: resolvedAgentsDir, availableTools: tools });

        // Create and return the squad instance
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

    // Emit an event
    emitEvent(event) {
        // Validate the event function
        if (typeof this.onEvent !== 'function') {
            return;
        }

        // Execute the function
        this.onEvent(event);
    }

    // Get the leader agent
    getLeaderAgent() {
        return this.leaderAgent;
    }

    // Get the leader spec
    getLeaderSpec() {
        return this.agentsSpecs.get(LEADER_SPEC_ID) || null;
    }

    // Get an agent spec by id
    getAgentSpec(id) {
        return this.agentsSpecs.get(id) || null;
    }

    // List all agent specs
    listAgentSpecs() {
        return [...this.agentsSpecs.values()];
    }

    // List all subagent specs (excluding the leader)
    listSubagentSpecs() {
        return this.listAgentSpecs().filter(agentSpec => agentSpec.id !== LEADER_SPEC_ID);
    }

    // Get a tool by name
    getTool(name) {
        return this.tools.get(name);
    }

    // List all tools
    listTools() {
        return [...this.tools.values()];
    }

    // List built-in tools available to an agent
    listBuiltInTools(agent) {
        return listPredefinedTools({
            squad: this,
            agent
        });
    }

    // Get a built-in tool by name for an agent
    getBuiltInTool(name, agent) {
        return getPredefinedTool({
            squad: this,
            agent,
            name
        });
    }

    // Get messages for a session
    getMessages(sessionId = DEFAULT_LEADER_SESSION_ID) {
        return this.requireAgentBySessionId(sessionId).getMessages();
    }

    // Send a message to an agent in a session
    async send(content, { sessionId = DEFAULT_LEADER_SESSION_ID, role = 'user' } = {}) {
        return this.requireAgentBySessionId(sessionId).send(content, { role });
    }

    // Spawn a subagent
    spawnSubagent(type, { prompt = '', parentSessionId = DEFAULT_LEADER_SESSION_ID } = {}) {
        return this.requireAgentBySessionId(parentSessionId).spawnSubagent(type, { prompt });
    }

    // Get an agent by id
    getAgent(agentId) {
        return this.findAgentById(agentId);
    }

    // List all running subagents
    listRunningSubagents() {
        return this.leaderAgent.listDescendants();
    }

    // Find an agent by id in the entire hierarchy
    findAgentById(agentId) {
        return this.leaderAgent.findById(agentId);
    }

    // Find an agent by session id in the entire hierarchy
    findAgentBySessionId(sessionId) {
        return this.leaderAgent.findBySessionId(sessionId);
    }

    // Require an agent by session id, throwing an error if not found
    requireAgentBySessionId(sessionId) {
        // Check if the session exists
        const agent = this.findAgentBySessionId(sessionId);
        if (!agent) {
            throw new Error(`Unknown session "${sessionId}".`);
        }

        // Return the agent
        return agent;
    }
}