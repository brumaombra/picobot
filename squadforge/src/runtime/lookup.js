import { DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID } from '../config.js';
import { Agent } from '../core/agent.js';
import { composeAgentPrompt } from '../prompts/prompts.js';
import { isLeaderAgent, normalizeSessionId } from '../utils/utils.js';

// Get the leader agent specification from the runtime registry
const getLeaderSpec = runtime => {
    return runtime.agentsSpecs.get(LEADER_SPEC_ID) || null;
};

// Get an agent specification by id
export const getAgentSpec = (runtime, id) => {
    return runtime.agentsSpecs.get(id) || null;
};

// List all specialized agent specs, excluding the leader
export const listSubagentSpecs = runtime => {
    return [...runtime.agentsSpecs.values()].filter(agentSpec => !isLeaderAgent(agentSpec.id));
};

// Compose the full system prompt for an agent using the runtime prompt templates
export const composePrompt = (runtime, agent) => {
    return composeAgentPrompt({
        runtime,
        agent,
        promptTemplates: runtime.promptTemplates
    });
};

// Get a tool definition by name from the runtime tool catalog
export const getTool = (runtime, name) => {
    return runtime.tools.get(name) || null;
};

// Find the first agent match across all session root agents
const findSessionAgentMatch = (runtime, resolveMatch) => {
    // Iterate through all root agents and attempt to resolve a match
    for (const rootAgent of runtime.sessionAgents.values()) {
        const match = resolveMatch(rootAgent);
        if (match) {
            return match;
        }
    }

    // If no match was found across any session tree, return null
    return null;
};

// Find an agent anywhere in the runtime by its agent id
export const findAgentById = (runtime, agentId) => {
    return findSessionAgentMatch(runtime, rootAgent => rootAgent.findById(agentId));
};

// Find an agent anywhere in the runtime by its session id
export const findAgentBySessionId = (runtime, sessionId) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    return findSessionAgentMatch(runtime, rootAgent => rootAgent.findBySessionId(normalizedSessionId));
};

// Get the root leader-style agent that owns the specified session tree
export const getRootAgentForSession = (runtime, sessionId) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    return findSessionAgentMatch(runtime, rootAgent => {
        return rootAgent.findBySessionId(normalizedSessionId) ? rootAgent : null;
    });
};

// Get or create a top-level session agent backed by the leader definition
export const getOrCreateSessionAgent = (runtime, sessionId = DEFAULT_LEADER_SESSION_ID) => {
    const normalizedSessionId = normalizeSessionId(sessionId);

    // Return the existing session agent if present
    const existingAgent = findAgentBySessionId(runtime, normalizedSessionId);
    if (existingAgent) {
        return existingAgent;
    }

    // Create and register a new session root agent for this session id
    const sessionAgent = new Agent({
        runtime,
        definition: getLeaderSpec(runtime),
        sessionId: normalizedSessionId
    });

    // Add the new session agent to the runtime registry
    runtime.sessionAgents.set(normalizedSessionId, sessionAgent);
    return sessionAgent;
};

// Get the leader-style agent responsible for a session, creating one if needed
export const getLeaderAgent = (runtime, sessionId = DEFAULT_LEADER_SESSION_ID) => {
    return getRootAgentForSession(runtime, sessionId) || getOrCreateSessionAgent(runtime, sessionId);
};

// Send content to a session by resolving its root agent and delegating to Agent.send(...)
export const sendToSession = async (runtime, content, { sessionId = DEFAULT_LEADER_SESSION_ID, role = 'user' } = {}) => {
    return getOrCreateSessionAgent(runtime, sessionId).send(content, { role });
};