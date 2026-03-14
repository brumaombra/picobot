import { DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID } from '../config.js';
import { composeAgentPrompt } from '../prompts/prompts.js';
import { normalizeSessionId } from '../utils/utils.js';

export const getLeaderSpec = runtime => {
    return runtime.agentsSpecs.get(LEADER_SPEC_ID) || null;
};

export const getAgentSpec = (runtime, id) => {
    return runtime.agentsSpecs.get(id) || null;
};

export const listAgentSpecs = runtime => {
    return [...runtime.agentsSpecs.values()];
};

export const listSubagentSpecs = runtime => {
    return listAgentSpecs(runtime).filter(agentSpec => agentSpec.id !== LEADER_SPEC_ID);
};

export const getSkill = (runtime, id) => {
    return runtime.skills.get(id) || null;
};

export const listSkills = runtime => {
    return [...runtime.skills.values()];
};

export const composePrompt = (runtime, agent) => {
    return composeAgentPrompt({
        runtime,
        agent,
        promptTemplates: runtime.promptTemplates
    });
};

export const getTool = (runtime, name) => {
    return runtime.tools.get(name) || null;
};

export const listTools = runtime => {
    return [...runtime.tools.values()];
};

export const findSessionAgentMatch = (runtime, resolveMatch) => {
    for (const rootAgent of runtime.sessionAgents.values()) {
        const match = resolveMatch(rootAgent);
        if (match) {
            return match;
        }
    }

    return null;
};

export const findAgentById = (runtime, agentId) => {
    return findSessionAgentMatch(runtime, rootAgent => rootAgent.findById(agentId));
};

export const findAgentBySessionId = (runtime, sessionId) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    return findSessionAgentMatch(runtime, rootAgent => rootAgent.findBySessionId(normalizedSessionId));
};

export const getRootAgentForSession = (runtime, sessionId) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    return findSessionAgentMatch(runtime, rootAgent => {
        return rootAgent.findBySessionId(normalizedSessionId) ? rootAgent : null;
    });
};

export const getOrCreateSessionAgent = (runtime, sessionId = DEFAULT_LEADER_SESSION_ID) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    const existingAgent = findAgentBySessionId(runtime, normalizedSessionId);
    if (existingAgent) {
        return existingAgent;
    }

    const sessionAgent = runtime.createAgent({
        definition: getLeaderSpec(runtime),
        sessionId: normalizedSessionId
    });
    runtime.sessionAgents.set(normalizedSessionId, sessionAgent);
    return sessionAgent;
};

export const getLeaderAgent = (runtime, sessionId = DEFAULT_LEADER_SESSION_ID) => {
    return getRootAgentForSession(runtime, sessionId) || getOrCreateSessionAgent(runtime, sessionId);
};

export const requireAgentBySessionId = (runtime, sessionId) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    const agent = findAgentBySessionId(runtime, normalizedSessionId);
    if (!agent) {
        throw new Error(`Unknown session "${normalizedSessionId}".`);
    }

    return agent;
};

export const getMessages = (runtime, sessionId = DEFAULT_LEADER_SESSION_ID) => {
    return getOrCreateSessionAgent(runtime, sessionId).getMessages();
};

export const sendToSession = async (runtime, content, { sessionId = DEFAULT_LEADER_SESSION_ID, role = 'user' } = {}) => {
    return getOrCreateSessionAgent(runtime, sessionId).send(content, { role });
};

export const spawnSubagentFromSession = (runtime, type, { prompt = '', parentSessionId = DEFAULT_LEADER_SESSION_ID } = {}) => {
    return requireAgentBySessionId(runtime, parentSessionId).spawnSubagent(type, { prompt });
};

export const getAgent = (runtime, agentId) => {
    return findAgentById(runtime, agentId);
};

export const listRunningSubagents = runtime => {
    return [...runtime.sessionAgents.values()].flatMap(agent => agent.listDescendants());
};