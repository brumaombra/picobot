import { join } from 'path';
import { AgentSpec } from '../core/agent-spec.js';
import { Agent } from '../core/agent.js';
import { DEFAULT_AGENTS_DIR_NAME, DEFAULT_CRONS_DIR_NAME, DEFAULT_PROMPTS_DIR_NAME, DEFAULT_RUNTIME_POLL_TIMEOUT_MS, DEFAULT_RUNTIME_TIMEOUT_MESSAGE, DEFAULT_SKILLS_DIR_NAME, DEFAULT_TOOLS_DIR_NAME, DEFAULT_SESSIONS_DIR_NAME, DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID, DEFAULT_LLM_CHAT_MAX_RETRIES, DEFAULT_MAX_MESSAGES_PER_SESSION, DEFAULT_MAX_RUNTIME_MS, DEFAULT_SESSION_TTL_MS, DEFAULT_WRAP_UP_THRESHOLD_MS, DEFAULT_LOGS_DIR_NAME, DEFAULT_LOG_LEVEL } from '../config.js';
import { loadAgentsFromDirectory } from '../loaders/load-agents.js';
import { loadCronsFromDirectory } from '../loaders/load-crons.js';
import { loadPromptTemplatesFromDirectory } from '../loaders/load-prompts.js';
import { loadSessionsFromDirectory } from '../loaders/load-sessions.js';
import { loadSkillsFromDirectory } from '../loaders/load-skills.js';
import { getLogFiles, initializeLogger, logger } from '../logging/logger.js';
import { CronManager } from '../crons/cron-manager.js';
import { loadTools } from '../loaders/load-tools.js';
import { SubagentRegistry } from './subagent-registry.js';
import { SessionManager } from '../sessions/session-manager.js';

// Run validation checks before loading runtime resources from disk
const beforeLoadChecks = options => {
    // The runtime options must be an object when provided
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
        throw new Error('Runtime options must be an object.');
    }

    // Destructure the options for validation
    const {
        rootDir,
        workspaceDir,
        agentsDir,
        promptsDir,
        skillsDir,
        toolsDir,
        sessionsDir,
        cronsDir,
        logsDir,
        model,
        appName,
        logLevel,
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
        ['workspaceDir', workspaceDir],
        ['agentsDir', agentsDir],
        ['promptsDir', promptsDir],
        ['skillsDir', skillsDir],
        ['toolsDir', toolsDir],
        ['sessionsDir', sessionsDir],
        ['cronsDir', cronsDir],
        ['logsDir', logsDir]
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

    if (appName !== undefined && appName !== null && typeof appName !== 'string') {
        throw new Error('Runtime option "appName" must be a string when provided.');
    }

    if (logLevel !== undefined && logLevel !== null && typeof logLevel !== 'string') {
        throw new Error('Runtime option "logLevel" must be a string when provided.');
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

// Load all filesystem-backed runtime resources during boot.
const loadRuntimeResources = async ({ promptsDir, skillsDir, toolsDir, agentsDir, sessionsDir, cronsDir } = {}) => {
    // read the various runtime resources
    const promptTemplates = loadPromptTemplatesFromDirectory({ promptsDir });
    const skills = loadSkillsFromDirectory({ skillsDir });
    const tools = await loadTools({ toolsDir });
    const agentsSpecs = loadAgentsFromDirectory({ agentsDir, availableTools: tools });
    const sessions = loadSessionsFromDirectory({ sessionsDir });
    const crons = loadCronsFromDirectory({ cronsDir });

    // Return the loaded resources
    return {
        promptTemplates,
        skills,
        tools,
        agentsSpecs,
        sessions,
        crons
    };
};

// Create the main runtime object
const createRuntime = async (options = {}) => {
    // Validate the runtime options before touching the filesystem
    beforeLoadChecks(options);

    // Destructure and resolve the configuration options with defaults
    const {
        rootDir,
        workspaceDir = null,
        agentsDir = null,
        promptsDir = null,
        skillsDir = null,
        toolsDir = null,
        sessionsDir = null,
        cronsDir = null,
        logsDir = null,
        llm = null,
        model = null,
        appName = null,
        logLevel = DEFAULT_LOG_LEVEL,
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
    const resolvedWorkspaceDir = workspaceDir || resolvedRootDir;
    const resolvedAgentsDir = agentsDir || join(resolvedRootDir, DEFAULT_AGENTS_DIR_NAME);
    const resolvedPromptsDir = promptsDir || join(resolvedRootDir, DEFAULT_PROMPTS_DIR_NAME);
    const resolvedSkillsDir = skillsDir || join(resolvedRootDir, DEFAULT_SKILLS_DIR_NAME);
    const resolvedToolsDir = toolsDir || join(resolvedRootDir, DEFAULT_TOOLS_DIR_NAME);
    const resolvedSessionsDir = sessionsDir || join(resolvedRootDir, DEFAULT_SESSIONS_DIR_NAME);
    const resolvedCronsDir = cronsDir || join(resolvedRootDir, DEFAULT_CRONS_DIR_NAME);
    const resolvedLogsDir = logsDir || join(resolvedRootDir, DEFAULT_LOGS_DIR_NAME);

    // Initialize the logger
    initializeLogger({
        rootDir: resolvedRootDir,
        logsDir: resolvedLogsDir,
        appName,
        level: logLevel
    });

    // Load all filesystem-backed runtime resources during boot
    const { promptTemplates, skills, tools, agentsSpecs, sessions, crons } = await loadRuntimeResources({
        promptsDir: resolvedPromptsDir,
        skillsDir: resolvedSkillsDir,
        toolsDir: resolvedToolsDir,
        agentsDir: resolvedAgentsDir,
        sessionsDir: resolvedSessionsDir,
        cronsDir: resolvedCronsDir
    });

    // Create the session manager
    const sessionManager = new SessionManager({
        sessionsDir: resolvedSessionsDir,
        maxMessagesPerSession,
        sessionTtlMs,
        sessions
    });

    // Perform validation checks after loading the runtime resources
    const leaderSpec = afterLoadChecks({ agentsSpecs });

    // Create the runtime object
    const runtime = {
        agentsSpecs,
        tools,
        skills,
        promptTemplates,
        sessionManager,
        rootDir: resolvedRootDir,
        workspaceDir: resolvedWorkspaceDir,
        agentsDir: resolvedAgentsDir,
        promptsDir: resolvedPromptsDir,
        skillsDir: resolvedSkillsDir,
        toolsDir: resolvedToolsDir,
        sessionsDir: resolvedSessionsDir,
        cronsDir: resolvedCronsDir,
        logsDir: resolvedLogsDir,
        logFiles: getLogFiles(),
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
        sessionAgents: new Map(),
        cronManager: null
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

    // Create the runtime-owned cron manager
    runtime.cronManager = new CronManager({
        runtime,
        cronsDir: resolvedCronsDir,
        crons
    });

    // Log and return the runtime object
    logger.info(`Runtime created for root directory: ${resolvedRootDir}`);
    return runtime;
};

// Forge the squad
export const forge = async options => {
    const runtime = await createRuntime(options);
    return runtime.sessionAgents.get(DEFAULT_LEADER_SESSION_ID);
};