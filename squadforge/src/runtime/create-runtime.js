import { join } from 'path';
import { AgentSpec } from '../core/agent-spec.js';
import { Agent } from '../core/agent.js';
import { DEFAULT_AGENTS_DIR_NAME, DEFAULT_PROMPTS_DIR_NAME, DEFAULT_RUNTIME_POLL_TIMEOUT_MS, DEFAULT_RUNTIME_TIMEOUT_MESSAGE, DEFAULT_SKILLS_DIR_NAME, DEFAULT_TOOLS_DIR_NAME, DEFAULT_SESSIONS_DIR_NAME, DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID, DEFAULT_LLM_CHAT_MAX_RETRIES, DEFAULT_MAX_MESSAGES_PER_SESSION, DEFAULT_MAX_RUNTIME_MS, DEFAULT_SESSION_TTL_MS, DEFAULT_WRAP_UP_THRESHOLD_MS } from '../config.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadPromptTemplatesFromDirectory } from '../loaders/load-prompts.js';
import { loadSkillsFromDirectory } from '../loaders/load-skills.js';
import { SessionStore } from '../sessions/session-store.js';
import { loadTools } from '../tools/tools-catalog.js';

export const createRuntime = ({ agentsSpecs = new Map(), tools = new Map(), skills = new Map(), promptTemplates = null, sessionStore = null, rootDir = null, agentsDir = null, promptsDir = null, skillsDir = null, toolsDir = null, sessionsDir = null, llm = null, model = null, maxRuntimeMs = DEFAULT_MAX_RUNTIME_MS, wrapUpThresholdMs = DEFAULT_WRAP_UP_THRESHOLD_MS, maxMessagesPerSession = DEFAULT_MAX_MESSAGES_PER_SESSION, sessionTtlMs = DEFAULT_SESSION_TTL_MS, llmChatMaxRetries = DEFAULT_LLM_CHAT_MAX_RETRIES, pollTimeoutMs = DEFAULT_RUNTIME_POLL_TIMEOUT_MS, timeoutMessage = DEFAULT_RUNTIME_TIMEOUT_MESSAGE, formatErrorMessage = null } = {}) => {
    const leaderSpec = agentsSpecs.get(LEADER_SPEC_ID);
    if (!(leaderSpec instanceof AgentSpec)) {
        throw new Error(`Runtime requires a leader spec with id "${LEADER_SPEC_ID}".`);
    }

    const resolvedPromptsDir = promptsDir || (rootDir ? join(rootDir, DEFAULT_PROMPTS_DIR_NAME) : DEFAULT_PROMPTS_DIR_NAME);
    const resolvedPromptTemplates = promptTemplates || loadPromptTemplatesFromDirectory({ promptsDir: resolvedPromptsDir });
    const resolvedSkillsDir = skillsDir || (rootDir ? join(rootDir, DEFAULT_SKILLS_DIR_NAME) : DEFAULT_SKILLS_DIR_NAME);
    const resolvedSessionsDir = sessionsDir || (rootDir ? join(rootDir, DEFAULT_SESSIONS_DIR_NAME) : DEFAULT_SESSIONS_DIR_NAME);
    const resolvedSessionStore = sessionStore || new SessionStore({ sessionsDir: resolvedSessionsDir, maxMessagesPerSession, sessionTtlMs });

    const runtime = {
        agentsSpecs,
        tools,
        skills,
        promptTemplates: resolvedPromptTemplates,
        sessionStore: resolvedSessionStore,
        rootDir,
        agentsDir,
        promptsDir: resolvedPromptsDir,
        skillsDir: resolvedSkillsDir,
        toolsDir,
        sessionsDir: resolvedSessionsDir,
        llm,
        model,
        maxRuntimeMs,
        wrapUpThresholdMs,
        llmChatMaxRetries,
        pollTimeoutMs,
        timeoutMessage,
        formatErrorMessage: formatErrorMessage || (error => {
            const message = error instanceof Error ? error.message : String(error);
            return `Sorry, I encountered an error: ${message}`;
        }),
        running: false,
        loopPromise: null,
        inboundQueue: [],
        inboundWaiters: [],
        inboundConnector: null,
        detachInboundConnector: null,
        outboundMessageHandler: null,
        eventHandlers: new Map(),
        sessionAgents: new Map(),
        createAgent: options => new Agent({ runtime, ...options })
    };

    const leaderAgent = runtime.createAgent({
        id: LEADER_SPEC_ID,
        definition: leaderSpec,
        sessionId: DEFAULT_LEADER_SESSION_ID
    });
    runtime.sessionAgents.set(DEFAULT_LEADER_SESSION_ID, leaderAgent);

    return runtime;
};

export const assembleRuntime = async ({ rootDir, agentsDir = null, promptsDir = null, skillsDir = null, toolsDir = null, sessionsDir = null, llm = null, model = null, maxRuntimeMs = DEFAULT_MAX_RUNTIME_MS, wrapUpThresholdMs = DEFAULT_WRAP_UP_THRESHOLD_MS, maxMessagesPerSession = DEFAULT_MAX_MESSAGES_PER_SESSION, sessionTtlMs = DEFAULT_SESSION_TTL_MS, llmChatMaxRetries = DEFAULT_LLM_CHAT_MAX_RETRIES, pollTimeoutMs = DEFAULT_RUNTIME_POLL_TIMEOUT_MS, timeoutMessage = DEFAULT_RUNTIME_TIMEOUT_MESSAGE, formatErrorMessage = null } = {}) => {
    const resolvedRootDir = rootDir || process.cwd();
    const resolvedAgentsDir = agentsDir || join(resolvedRootDir, DEFAULT_AGENTS_DIR_NAME);
    const resolvedPromptsDir = promptsDir || join(resolvedRootDir, DEFAULT_PROMPTS_DIR_NAME);
    const resolvedSkillsDir = skillsDir || join(resolvedRootDir, DEFAULT_SKILLS_DIR_NAME);
    const resolvedToolsDir = toolsDir || join(resolvedRootDir, DEFAULT_TOOLS_DIR_NAME);
    const resolvedSessionsDir = sessionsDir || join(resolvedRootDir, DEFAULT_SESSIONS_DIR_NAME);

    const resolvedPromptTemplates = loadPromptTemplatesFromDirectory({ promptsDir: resolvedPromptsDir });
    const resolvedSkills = loadSkillsFromDirectory({ skillsDir: resolvedSkillsDir });
    const resolvedSessionStore = new SessionStore({ sessionsDir: resolvedSessionsDir, maxMessagesPerSession, sessionTtlMs });
    const tools = await loadTools({ toolsDir: resolvedToolsDir });
    const agentsSpecs = loadAgentsFromDirectory({ agentsDir: resolvedAgentsDir, availableTools: tools });

    return createRuntime({
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
        llmChatMaxRetries,
        pollTimeoutMs,
        timeoutMessage,
        formatErrorMessage
    });
};

export const assembleRootAgent = async options => {
    const runtime = await assembleRuntime(options);
    return runtime.sessionAgents.get(DEFAULT_LEADER_SESSION_ID);
};