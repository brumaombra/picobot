import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DONE_STATUS, RUNNING_STATUS } from '../src/config.js';
import { forge } from '../src/index.js';

// Build one fake tool call in the shape expected by the runtime
const createToolCall = (id, name, args) => {
    return {
        id: `tool_call_${id}`,
        type: 'function',
        function: {
            name,
            arguments: JSON.stringify(args)
        }
    };
};

// Parse JSON payloads safely from assistant and tool message content
const tryParseJson = content => {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
};

// Find the latest parsed JSON payload in the message list that matches the predicate
const findLatestJsonPayload = (messages, predicate) => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const payload = tryParseJson(messages[index]?.content);
        if (payload && predicate(payload)) {
            return payload;
        }
    }

    return null;
};

// Wait until one condition becomes truthy or fail after a short timeout
const waitFor = async (resolveValue, { timeoutMs = 5_000, intervalMs = 10 } = {}) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const value = resolveValue();
        if (value) {
            return value;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Timed out while waiting for the expected communication state.');
};

// Minimal fake LLM that drives only the worker side of the conversation
class BidirectionalCommunicationLlm {
    constructor() {
        this.nextToolCallId = 1;
        this.subagentSnapshots = [];
    }

    // Only the worker should call into this fake LLM during the test
    async chat(messages, tools) {
        const toolNames = new Set(tools.map(tool => tool?.function?.name));

        if (toolNames.has('ask_main_agent')) {
            return this.chatWorker(messages);
        }

        throw new Error('Unexpected agent tool surface in communication test.');
    }

    // Simulate a worker that asks one question, then consumes both the answer and a later leader follow-up message
    chatWorker(messages) {
        this.subagentSnapshots.push(messages.map(message => ({
            role: message.role,
            content: message.content
        })));

        const answerPayload = findLatestJsonPayload(messages, payload => typeof payload.answer === 'string');
        if (!answerPayload) {
            return {
                content: '',
                tool_calls: [createToolCall(this.nextToolCallId++, 'ask_main_agent', {
                    question: 'Which label should I use?'
                })],
                finish_reason: 'tool_calls'
            };
        }

        const followUpMessage = [...messages]
            .reverse()
            .find(message => message.role === 'user' && message.content === 'Also mention BETA.');

        return {
            content: `Worker report: label=${answerPayload.answer}; follow_up=${followUpMessage?.content || 'missing'}`,
            tool_calls: [],
            finish_reason: 'stop'
        };
    }
}

test('leader and subagent support bidirectional communication', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'squadforge-communication-'));

    try {
        const agentsDir = join(rootDir, 'agents');
        mkdirSync(agentsDir, { recursive: true });

        writeFileSync(join(agentsDir, 'leader.md'), `---
name: Leader
description: Test leader.
---

Start the worker, answer its question, and return the final worker report.`);

        writeFileSync(join(agentsDir, 'worker.md'), `---
name: Worker
description: Test worker.
---

Ask the leader which label to use, then continue the task and incorporate any later follow-up message before finishing.`);

        const llm = new BidirectionalCommunicationLlm();
        const leader = await forge({
            rootDir,
            llm,
            appName: 'squadforge-test',
            maxRuntimeMs: 15_000,
            wrapUpThresholdMs: 1_000,
            pollTimeoutMs: 10
        });

        const subagentStartTool = leader.getTool('subagent_start');
        const subagentChatTool = leader.getTool('subagent_chat');
        const subagentListTool = leader.getTool('subagent_list');

        let runningChatPromise = null;
        let runningSubagentId = null;

        const unsubscribe = leader.on('toolFinish', event => {
            if (event.agentType !== 'worker' || event.toolName !== 'ask_main_agent' || runningChatPromise) {
                return;
            }

            runningSubagentId = event.agentId;
            runningChatPromise = subagentChatTool.execute({
                subagent_id: event.agentId,
                prompt: 'Also mention BETA.'
            }, {
                chatSubagent: (subagentId, prompt) => leader.chatSubagent(subagentId, prompt)
            });
        });

        const launchedSubagent = await subagentStartTool.execute({
            agentId: 'worker',
            prompt: 'Ask the leader which label to use. After the answer, include any later follow-up message you receive before finishing.'
        }, {
            launchSubagent: (agentId, prompt) => leader.launchSubagent(agentId, prompt)
        });

        assert.equal(typeof launchedSubagent.subagent_id, 'string');

        const activeSubagentsResult = await subagentListTool.execute({}, {
            listActiveSubagents: () => leader.listActiveSubagents()
        });

        assert.equal(activeSubagentsResult.count, 1);
        assert.equal(activeSubagentsResult.active_subagents.length, 1);
        assert.equal(activeSubagentsResult.active_subagents[0].subagent_id, launchedSubagent.subagent_id);
        assert.equal(activeSubagentsResult.active_subagents[0].type, 'worker');
        assert.equal(activeSubagentsResult.active_subagents[0].status, RUNNING_STATUS);

        await waitFor(() => {
            return leader.runtime.subagentRegistry.getPendingQuestion(launchedSubagent.subagent_id);
        });

        const answerResult = await subagentChatTool.execute({
            subagent_id: launchedSubagent.subagent_id,
            prompt: 'Use ALPHA as the label.'
        }, {
            chatSubagent: (subagentId, prompt) => leader.chatSubagent(subagentId, prompt)
        });

        assert.equal(answerResult.status, RUNNING_STATUS);
        assert.equal(answerResult.response, 'Use ALPHA as the label.');
        assert.equal(answerResult.timed_out, false);

        await waitFor(() => runningChatPromise);
        assert.ok(runningChatPromise, 'Expected a follow-up chat to be sent to the running subagent.');

        const runningChatResult = await runningChatPromise;
        unsubscribe();

        assert.equal(runningChatResult.status, RUNNING_STATUS);
        assert.equal(runningChatResult.response, null);
        assert.equal(runningChatResult.timed_out, false);

        const finalNotification = await waitFor(() => {
            return findLatestJsonPayload(leader.getMessages(), payload => {
                return payload.type === 'subagent_notification' && typeof payload.response === 'string';
            });
        });

        const questionNotification = findLatestJsonPayload(leader.getMessages(), payload => payload.type === 'subagent_question');

        assert.ok(questionNotification, 'Expected the worker to notify the leader with a question.');
        assert.ok(finalNotification, 'Expected the worker to notify the leader with its final response.');
        assert.match(finalNotification.response, /label=Use ALPHA as the label\./);
        assert.match(finalNotification.response, /follow_up=Also mention BETA\./);

        const completedSubagentsResult = await subagentListTool.execute({}, {
            listActiveSubagents: () => leader.listActiveSubagents()
        });

        assert.equal(completedSubagentsResult.count, 0);
        assert.deepEqual(completedSubagentsResult.active_subagents, []);

        assert.ok(runningSubagentId, 'Expected the running subagent id to be captured from tool events.');
        assert.equal(leader.runtime.subagentRegistry.get(runningSubagentId)?.status, DONE_STATUS);

        assert.ok(llm.subagentSnapshots.length >= 2, 'Expected the worker LLM to run at least twice.');

        const resumedSnapshot = llm.subagentSnapshots[llm.subagentSnapshots.length - 1];
        const answerIndex = resumedSnapshot.findIndex(message => {
            const payload = tryParseJson(message.content);
            return message.role === 'tool' && payload?.answer === 'Use ALPHA as the label.';
        });
        const followUpIndex = resumedSnapshot.findIndex(message => {
            return message.role === 'user' && message.content === 'Also mention BETA.';
        });

        assert.ok(answerIndex >= 0, 'Expected the resumed worker loop to include the leader answer tool result.');
        assert.ok(followUpIndex >= 0, 'Expected the running subagent follow-up chat to be visible in the resumed worker loop.');
    } finally {
        rmSync(rootDir, { recursive: true, force: true });
    }
});