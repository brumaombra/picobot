import { join } from 'path';
import { AgentSpec } from '../core/agent-spec.js';
import { Agent } from '../core/agent.js';
import { DEFAULT_AGENTS_DIR_NAME, DEFAULT_PROMPTS_DIR_NAME, DEFAULT_RUNTIME_POLL_TIMEOUT_MS, DEFAULT_RUNTIME_TIMEOUT_MESSAGE, DEFAULT_SKILLS_DIR_NAME, DEFAULT_TOOLS_DIR_NAME, DEFAULT_SESSIONS_DIR_NAME, DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID, DEFAULT_LLM_CHAT_MAX_RETRIES, DEFAULT_MAX_MESSAGES_PER_SESSION, DEFAULT_MAX_RUNTIME_MS, DEFAULT_SESSION_TTL_MS, DEFAULT_WRAP_UP_THRESHOLD_MS } from '../config.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadPromptTemplatesFromDirectory } from '../loaders/load-prompts.js';
import { loadSkillsFromDirectory } from '../loaders/load-skills.js';
import { SubagentRegistry } from './subagent-registry.js';
import { SessionStore } from '../sessions/session-store.js';
import { loadTools } from '../tools/tools-catalog.js';

// Run validation checks before loading runtime resources from disk
const beforeLoadChecks = options => {
    // The runtime options must be an object when provided
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
        throw new Error('Runtime options must be an object.');
    }

    // Destructure the options for validation
    const {
        rootDir,
        agentsDir,
        promptsDir,
        skillsDir,
        toolsDir,
        sessionsDir,
        model,
        maxRuntimeMs,
        wrapUpThresholdMs,
        maxMessagesPerSession,
        sessionTtlMs,
        llmChatMaxRetries,
        pollTimeoutMs,
        timeoutMessage
    } = options;

    // Validate the paths
    const pathOptions = [
        ['rootDir', rootDir],
        ['agentsDir', agentsDir],
        ['promptsDir', promptsDir],
        ['skillsDir', skillsDir],
        ['toolsDir', toolsDir],
        ['sessionsDir', sessionsDir]
    ];

    // Validate any provided path-like options
    for (const [optionName, optionValue] of pathOptions) {
        if (optionValue !== undefined && optionValue !== null && typeof optionValue !== 'string') {
            throw new Error(`Runtime option "${optionName}" must be a string when provided.`);
        }
    }

    // Validate the model option
    if (model !== undefined && model !== null && typeof model !== 'string') {
        throw new Error('Runtime option "model" must be a string when provided.');
    }

    // Validate the timeout message option
    if (timeoutMessage !== undefined && timeoutMessage !== null && typeof timeoutMessage !== 'string') {
        throw new Error('Runtime option "timeoutMessage" must be a string when provided.');
    }

    // Validate numeric runtime controls when provided
    const numericOptions = [
        ['maxRuntimeMs', maxRuntimeMs],
        ['wrapUpThresholdMs', wrapUpThresholdMs],
        ['maxMessagesPerSession', maxMessagesPerSession],
        ['sessionTtlMs', sessionTtlMs],
        ['llmChatMaxRetries', llmChatMaxRetries],
        ['pollTimeoutMs', pollTimeoutMs]
    ];

    // Validate numeric runtime controls when provided
    for (const [optionName, optionValue] of numericOptions) {
        if (optionValue !== undefined && optionValue !== null && (!Number.isFinite(optionValue) || optionValue < 0)) {
            throw new Error(`Runtime option "${optionName}" must be a non-negative number when provided.`);
        }
    }
};

// Run validation checks after loading the runtime resources from disk
const afterLoadChecks = ({ agentsSpecs }) => {
    // Check if the required leader agent spec is present
    const leaderSpec = agentsSpecs.get(LEADER_SPEC_ID);
    if (!(leaderSpec instanceof AgentSpec)) {
        throw new Error(`Runtime requires a leader spec with id "${LEADER_SPEC_ID}".`);
    }

    // Return the validated leader spec for runtime bootstrapping
    return leaderSpec;
};

// Create the main runtime object
const createRuntime = async (options = {}) => {
    // Validate the runtime options before touching the filesystem
    beforeLoadChecks(options);

    // Destructure and resolve the configuration options with defaults
    const {
        rootDir,
        agentsDir = null,
        promptsDir = null,
        skillsDir = null,
        toolsDir = null,
        sessionsDir = null,
        llm = null,
        model = null,
        maxRuntimeMs = DEFAULT_MAX_RUNTIME_MS,
        wrapUpThresholdMs = DEFAULT_WRAP_UP_THRESHOLD_MS,
        maxMessagesPerSession = DEFAULT_MAX_MESSAGES_PER_SESSION,
        sessionTtlMs = DEFAULT_SESSION_TTL_MS,
        llmChatMaxRetries = DEFAULT_LLM_CHAT_MAX_RETRIES,
        pollTimeoutMs = DEFAULT_RUNTIME_POLL_TIMEOUT_MS,
        timeoutMessage = DEFAULT_RUNTIME_TIMEOUT_MESSAGE
    } = options;

    // Resolve the directory paths
    const resolvedRootDir = rootDir || process.cwd();
    const resolvedAgentsDir = agentsDir || join(resolvedRootDir, DEFAULT_AGENTS_DIR_NAME);
    const resolvedPromptsDir = promptsDir || join(resolvedRootDir, DEFAULT_PROMPTS_DIR_NAME);
    const resolvedSkillsDir = skillsDir || join(resolvedRootDir, DEFAULT_SKILLS_DIR_NAME);
    const resolvedToolsDir = toolsDir || join(resolvedRootDir, DEFAULT_TOOLS_DIR_NAME);
    const resolvedSessionsDir = sessionsDir || join(resolvedRootDir, DEFAULT_SESSIONS_DIR_NAME);

    // Load the components of the runtime from the filesystem
    const promptTemplates = loadPromptTemplatesFromDirectory({ promptsDir: resolvedPromptsDir });
    const skills = loadSkillsFromDirectory({ skillsDir: resolvedSkillsDir });
    const tools = await loadTools({ toolsDir: resolvedToolsDir });
    const agentsSpecs = loadAgentsFromDirectory({ agentsDir: resolvedAgentsDir, availableTools: tools });
    const sessionStore = new SessionStore({ sessionsDir: resolvedSessionsDir, maxMessagesPerSession, sessionTtlMs });

    // Perform validation checks after loading the runtime resources
    const leaderSpec = afterLoadChecks({ agentsSpecs });

    // Create the runtime object
    const runtime = {
        agentsSpecs,
        tools,
        skills,
        promptTemplates,
        sessionStore,
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
        llmChatMaxRetries,
        pollTimeoutMs,
        timeoutMessage,
        running: false,
        loopPromise: null,
        inboundQueue: [],
        inboundWaiters: [],
        inboundConnector: null,
        detachInboundConnector: null,
        outboundMessageHandler: null,
        eventHandlers: new Map(),
        subagentRegistry: new SubagentRegistry(),
        sessionAgents: new Map()
    };

    // Create the leader agent
    const leaderAgent = new Agent({
        runtime,
        id: LEADER_SPEC_ID,
        definition: leaderSpec,
        sessionId: DEFAULT_LEADER_SESSION_ID
    });

    // Add the leader agent to the runtime session
    runtime.sessionAgents.set(DEFAULT_LEADER_SESSION_ID, leaderAgent);

    // Return the runtime object
    return runtime;
};

// Forge the squad
export const forge = async options => {
    const runtime = await createRuntime(options);
    return runtime.sessionAgents.get(DEFAULT_LEADER_SESSION_ID);
};