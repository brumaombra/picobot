import { DONE_STATUS, FAILED_STATUS, RUNNING_STATUS, SUBAGENT_QUESTION_TIMEOUT_MS } from '../config.js';
import { queueRuntimeMessage } from './channel.js';
import { emitRuntimeEvent } from './events.js';
import { findAgentById, getAgentSpec, getLeaderAgent, listSubagentSpecs } from './lookup.js';

/******************************* Local helpers *******************************/

// Resolve the leader agent that owns the current session tree
const getLeaderSessionAgent = agent => {
    return getLeaderAgent(agent.runtime, agent.sessionId);
};

// Build the shared notification payload used for tracked subagent updates
const createSubagentPayload = (agent, fields = {}) => {
    return {
        subagent_id: agent.id,
        name: agent.name,
        subagent_type: agent.definition.id,
        ...fields
    };
};

// Notify the leader session of a tracked subagent update
const notifyLeaderSession = (agent, payload) => {
    const leaderAgent = getLeaderSessionAgent(agent);
    const message = {
        sessionId: leaderAgent.sessionId,
        role: 'assistant',
        content: JSON.stringify(payload)
    };

    // Queue the message into the runtime loop when it is active
    if (agent.runtime.running) {
        queueRuntimeMessage(agent.runtime, message);
        return;
    }

    // Otherwise append the notification directly so one-shot agent.send(...) flows still see it
    leaderAgent.ensureSession();
    leaderAgent.appendMessage({
        role: 'assistant',
        content: message.content
    });
};

// Track the outcome of a subagent run in the runtime registry
const completeTrackedSubagent = (agent, result) => {
    const response = result?.response || null;

    // Mark the subagent as done if it produced a response
    if (response) {
        agent.runtime.subagentRegistry.done(agent.id, response);
        return createSubagentPayload(agent, {
            status: DONE_STATUS,
            response
        });
    }

    // Otherwise, mark the subagent as failed with an appropriate message
    const failureMessage = result?.timedOut ? 'Subagent timed out without completing the work.' : 'Subagent completed without producing a response.';
    agent.runtime.subagentRegistry.fail(agent.id, failureMessage);
    return createSubagentPayload(agent, {
        status: FAILED_STATUS,
        response: failureMessage
    });
};

// Mark a tracked subagent as failed and build the failure notification payload
const failTrackedSubagent = (agent, error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    agent.runtime.subagentRegistry.fail(agent.id, errorMessage);
    return createSubagentPayload(agent, {
        status: FAILED_STATUS,
        response: errorMessage
    });
};

// Resolve a tracked subagent and ensure it belongs to the current session tree
const getTrackedSubagent = (agent, subagentId) => {
    const subagent = agent.runtime.subagentRegistry.get(subagentId);

    // Validate that the subagent exists
    if (!subagent) {
        throw new Error(`Unknown subagent_id "${subagentId}".`);
    }

    // Validate that the subagent belongs to the current session tree
    if (subagent.parentSessionId !== getLeaderSessionAgent(agent).sessionId) {
        throw new Error(`Subagent "${subagentId}" does not belong to the current session.`);
    }

    // Return the resolved subagent
    return subagent;
};

/******************************* Public subagent runtime helpers *******************************/

// Spawn a subagent for the current agent
export const spawnSubagent = async (agent, type, { prompt = '' } = {}) => {
    const definition = getAgentSpec(agent.runtime, type);

    // Validate that the subagent type exists
    if (!definition) {
        const available = listSubagentSpecs(agent.runtime).map(spec => spec.id).join(', ');
        throw new Error(`Unknown subagent "${type}". Available subagents: ${available}`);
    }

    // Create the child agent instance and ensure its session is initialized
    const childAgent = new agent.constructor({
        runtime: agent.runtime,
        definition,
        parent: agent,
        initialPrompt: prompt
    });

    // Ensure the child agent session is initialized
    childAgent.ensureSession();

    // Add the child agent to the parent's subagents map
    agent.subagents.set(childAgent.id, childAgent);

    // Emit an event for the new subagent spawn
    emitRuntimeEvent(agent.runtime, 'agentSpawn', {
        parentAgentId: agent.id,
        parentAgentType: agent.definition.id,
        agentId: childAgent.id,
        agentType: childAgent.definition.id,
        sessionId: childAgent.sessionId
    });

    // Return the child agent instance
    return childAgent;
};

// Launch a subagent in the background and return immediately with its metadata
export const launchSubagent = async (agent, type, prompt = '') => {
    const childAgent = await spawnSubagent(agent, type, { prompt });

    // Register the subagent before starting it so progress, chat, and questions can resolve it immediately
    agent.runtime.subagentRegistry.register(childAgent.id, {
        type: childAgent.definition.id,
        name: childAgent.name,
        sessionId: childAgent.sessionId,
        parentAgentId: agent.id,
        parentSessionId: getLeaderSessionAgent(agent).sessionId,
        prompt
    });

    // Run the child without awaiting it and report its final outcome back to the leader session
    childAgent.run().then(result => {
        notifyLeaderSession(agent, {
            type: 'subagent_notification',
            ...completeTrackedSubagent(childAgent, result)
        });
    }).catch(error => {
        notifyLeaderSession(agent, {
            type: 'subagent_notification',
            ...failTrackedSubagent(childAgent, error)
        });
    });

    // Return the new subagent metadata
    return {
        subagentId: childAgent.id,
        type: childAgent.definition.id,
        name: childAgent.name
    };
};

// Ask the leader agent a question from inside a running subagent and wait for the reply
export const askMainAgent = (agent, question) => {
    // Only running subagents can ask questions back to the leader
    if (!agent.parent) {
        return Promise.reject(new Error('askMainAgent can only be called from within a running subagent.'));
    }

    // Validate the question text before parking the subagent on a pending reply
    const questionText = String(question || '').trim();
    if (!questionText) {
        return Promise.reject(new Error('A question is required.'));
    }

    // Park the subagent until the leader answers through subagent_chat or the timeout expires
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            agent.runtime.subagentRegistry.clearQuestion(agent.id);
            reject(new Error('Main agent did not reply within the time limit.'));
        }, SUBAGENT_QUESTION_TIMEOUT_MS);

        // Store the pending resolvers so a later subagent_chat call can resume the subagent
        agent.runtime.subagentRegistry.registerQuestion(agent.id,
            answer => {
                clearTimeout(timeoutId);
                agent.runtime.subagentRegistry.clearQuestion(agent.id);
                resolve(answer);
            },
            error => {
                clearTimeout(timeoutId);
                agent.runtime.subagentRegistry.clearQuestion(agent.id);
                reject(error);
            }
        );

        // Emit a structured notification back to the leader session so it can answer the question
        notifyLeaderSession(agent, {
            type: 'subagent_question',
            ...createSubagentPayload(agent),
            question: questionText
        });
    });
};

// Chat with a tracked subagent by id, either answering a pending question or resuming its session
export const chatSubagent = async (agent, subagentId, message) => {
    const subagent = getTrackedSubagent(agent, subagentId);
    const text = String(message || '').trim();

    // Validate the new chat input
    if (!text) {
        throw new Error('A chat prompt is required.');
    }

    // Failed subagents cannot be resumed through chat
    if (subagent.status === FAILED_STATUS) {
        throw new Error(`Cannot send a message to subagent "${subagentId}" because it has failed.`);
    }

    // If the subagent is waiting on ask_main_agent, resolve that question immediately
    const pendingQuestion = agent.runtime.subagentRegistry.getPendingQuestion(subagentId);
    if (pendingQuestion) {
        pendingQuestion.resolve(text);
        return {
            subagent_id: subagentId,
            type: subagent.type,
            name: subagent.name,
            status: RUNNING_STATUS,
            response: text,
            timed_out: false
        };
    }

    // Otherwise resolve the live child agent instance so the chat can continue in its session
    const childAgent = findAgentById(agent.runtime, subagentId);
    if (!childAgent) {
        throw new Error(`Tracked subagent "${subagentId}" could not be resolved.`);
    }

    // If the subagent is still mid-run, queue the message for its next turn instead of racing another run
    if (subagent.status === RUNNING_STATUS) {
        // Queue the message
        childAgent.appendMessage({
            role: 'user',
            content: text
        });

        // Return the current subagent status
        return {
            subagent_id: subagentId,
            type: subagent.type,
            name: subagent.name,
            status: RUNNING_STATUS,
            response: null,
            timed_out: false
        };
    }

    // Completed subagents can be resumed by sending a new user message into the same session
    agent.runtime.subagentRegistry.resume(subagentId);
    const result = await childAgent.send(text);
    const trackedResult = completeTrackedSubagent(childAgent, result);

    // Return the resumed subagent outcome in the same shape used elsewhere by the leader tools
    return {
        subagent_id: subagentId,
        type: subagent.type,
        name: subagent.name,
        status: trackedResult.status,
        response: trackedResult.response,
        timed_out: Boolean(result?.timedOut)
    };
};

// List all currently active subagents for the current leader session
export const listActiveSubagents = agent => {
    return agent.runtime.subagentRegistry.listActive({
        parentSessionId: getLeaderSessionAgent(agent).sessionId
    });
};