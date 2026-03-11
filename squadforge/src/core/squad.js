import { join } from 'path';
import { AgentSpec } from './agent-spec.js';
import { Agent } from './agent.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadPromptTemplatesFromDirectory } from '../loaders/load-prompts.js';
import { loadToolsFromDirectory } from '../loaders/load-tools.js';
import { loadSkillsFromDirectory } from '../loaders/load-skills.js';
import { SessionStore } from '../sessions/session-store.js';
import { DEFAULT_AGENTS_DIR_NAME, DEFAULT_PROMPTS_DIR_NAME, DEFAULT_SKILLS_DIR_NAME, DEFAULT_TOOLS_DIR_NAME, DEFAULT_SESSIONS_DIR_NAME, DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID, DEFAULT_LLM_CHAT_MAX_RETRIES, DEFAULT_MAX_MESSAGES_PER_SESSION, DEFAULT_MAX_RUNTIME_MS, DEFAULT_SESSION_TTL_MS, DEFAULT_WRAP_UP_THRESHOLD_MS } from '../config.js';
import { composeAgentPrompt } from '../prompts/prompts.js';
import { getPredefinedTool, listPredefinedTools } from '../tools/tools.js';

// Squad class
export class Squad {
    // Constructor
    constructor({ agentsSpecs = new Map(), tools = new Map(), skills = new Map(), promptTemplates = null, sessionStore = null, rootDir = null, agentsDir = null, promptsDir = null, skillsDir = null, toolsDir = null, sessionsDir = null, llm = null, model = null, maxRuntimeMs = DEFAULT_MAX_RUNTIME_MS, wrapUpThresholdMs = DEFAULT_WRAP_UP_THRESHOLD_MS, maxMessagesPerSession = DEFAULT_MAX_MESSAGES_PER_SESSION, sessionTtlMs = DEFAULT_SESSION_TTL_MS, llmChatMaxRetries = DEFAULT_LLM_CHAT_MAX_RETRIES } = {}) {
        // Validate that the leader spec is present
        const leaderSpec = agentsSpecs.get(LEADER_SPEC_ID);
        if (!(leaderSpec instanceof AgentSpec)) {
            throw new Error(`Squad requires a leader spec with id "${LEADER_SPEC_ID}".`);
        }

        // Resolve the prompts directory and load prompt templates
        const resolvedPromptsDir = promptsDir || (rootDir ? join(rootDir, DEFAULT_PROMPTS_DIR_NAME) : DEFAULT_PROMPTS_DIR_NAME);
        const resolvedPromptTemplates = promptTemplates || loadPromptTemplatesFromDirectory({ promptsDir: resolvedPromptsDir });
        const resolvedSkillsDir = skillsDir || (rootDir ? join(rootDir, DEFAULT_SKILLS_DIR_NAME) : DEFAULT_SKILLS_DIR_NAME);

        // Resolve the sessions directory and session store
        const resolvedSessionsDir = sessionsDir || (rootDir ? join(rootDir, DEFAULT_SESSIONS_DIR_NAME) : DEFAULT_SESSIONS_DIR_NAME);
        const resolvedSessionStore = sessionStore || new SessionStore({ sessionsDir: resolvedSessionsDir, maxMessagesPerSession, sessionTtlMs });

        // Initialize properties
        this.agentsSpecs = agentsSpecs;
        this.tools = tools;
        this.skills = skills;
        this.promptTemplates = resolvedPromptTemplates;
        this.sessionStore = resolvedSessionStore;
        this.rootDir = rootDir;
        this.agentsDir = agentsDir;
        this.promptsDir = resolvedPromptsDir;
        this.skillsDir = resolvedSkillsDir;
        this.toolsDir = toolsDir;
        this.sessionsDir = resolvedSessionsDir;
        this.llm = llm;
        this.model = model;
        this.maxRuntimeMs = maxRuntimeMs;
        this.wrapUpThresholdMs = wrapUpThresholdMs;
        this.llmChatMaxRetries = llmChatMaxRetries;
        this.eventHandlers = new Map();
        this.leaderAgent = new Agent({
            id: LEADER_SPEC_ID,
            definition: leaderSpec,
            squad: this,
            sessionId: DEFAULT_LEADER_SESSION_ID
        });
    }

    // Main method to assemble the squad
    static async assemble({ rootDir, agentsDir = null, promptsDir = null, skillsDir = null, toolsDir = null, sessionsDir = null, llm = null, model = null, maxRuntimeMs = DEFAULT_MAX_RUNTIME_MS, wrapUpThresholdMs = DEFAULT_WRAP_UP_THRESHOLD_MS, maxMessagesPerSession = DEFAULT_MAX_MESSAGES_PER_SESSION, sessionTtlMs = DEFAULT_SESSION_TTL_MS, llmChatMaxRetries = DEFAULT_LLM_CHAT_MAX_RETRIES } = {}) {
        // Resolve directories
        const resolvedRootDir = rootDir || process.cwd();
        const resolvedAgentsDir = agentsDir || join(resolvedRootDir, DEFAULT_AGENTS_DIR_NAME);
        const resolvedPromptsDir = promptsDir || join(resolvedRootDir, DEFAULT_PROMPTS_DIR_NAME);
        const resolvedSkillsDir = skillsDir || join(resolvedRootDir, DEFAULT_SKILLS_DIR_NAME);
        const resolvedToolsDir = toolsDir || join(resolvedRootDir, DEFAULT_TOOLS_DIR_NAME);
        const resolvedSessionsDir = sessionsDir || join(resolvedRootDir, DEFAULT_SESSIONS_DIR_NAME);

        // Load or create resources
        const resolvedPromptTemplates = loadPromptTemplatesFromDirectory({ promptsDir: resolvedPromptsDir });
        const resolvedSkills = loadSkillsFromDirectory({ skillsDir: resolvedSkillsDir });
        const resolvedSessionStore = new SessionStore({ sessionsDir: resolvedSessionsDir, maxMessagesPerSession, sessionTtlMs });
        const tools = await loadToolsFromDirectory({ toolsDir: resolvedToolsDir });
        const agentsSpecs = loadAgentsFromDirectory({ agentsDir: resolvedAgentsDir, availableTools: tools });

        // Create and return the squad instance
        return new Squad({
            agentsSpecs,
            tools,
            skills: resolvedSkills,
            promptTemplates: resolvedPromptTemplates,
            sessionStore: resolvedSessionStore,
            rootDir: resolvedRootDir,
            agentsDir: resolvedAgentsDir,
            promptsDir: resolvedPromptsDir,
            skillsDir: resolvedSkillsDir,
            toolsDir: resolvedToolsDir,
            sessionsDir: resolvedSessionsDir,
            llm,
            model,
            maxRuntimeMs,
            wrapUpThresholdMs,
            maxMessagesPerSession,
            sessionTtlMs,
            llmChatMaxRetries
        });
    }

    // Register an event handler
    on(eventId, handler) {
        // Validate eventId
        if (!eventId) {
            throw new Error('Squad.on requires an eventId.');
        }

        // Validate handler
        if (typeof handler !== 'function') {
            throw new Error('Squad.on requires a handler function.');
        }

        // Add the handler to the set of handlers for the event
        const handlers = this.eventHandlers.get(eventId) || new Set();
        handlers.add(handler);
        this.eventHandlers.set(eventId, handlers);

        // Return an unsubscribe function
        return () => {
            // Delete the handler from the set of handlers for the event
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.eventHandlers.delete(eventId);
            }
        };
    }

    // Emit an event
    emitEvent(eventId, eventData = {}) {
        // Validate eventId
        const handlers = this.eventHandlers.get(eventId) || new Set();
        if (handlers.size === 0) {
            return;
        }

        // Call each handler for the event
        for (const handler of handlers) {
            handler(eventData);
        }
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

    // Get a skill by id
    getSkill(id) {
        return this.skills.get(id) || null;
    }

    // List all skills
    listSkills() {
        return [...this.skills.values()];
    }

    // Compose the runtime prompt for an agent
    composePrompt(agent) {
        return composeAgentPrompt({
            squad: this,
            agent,
            promptTemplates: this.promptTemplates
        });
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