import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forge } from '../src/index.js';

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

    throw new Error('Timed out while waiting for the expected cron state.');
};

// Simple LLM used to confirm that cron-delivered system messages reach the leader loop
class CronEchoLlm {
    async chat(messages) {
        const latestSystemMessage = [...messages]
            .reverse()
            .find(message => message.role === 'system' && message.content && !message.content.includes('You are'));

        return {
            content: latestSystemMessage
                ? `Handled cron message: ${latestSystemMessage.content}`
                : 'No cron message received.',
            tool_calls: [],
            finish_reason: 'stop'
        };
    }
}

test('cron tools manage persisted crons and deliver queued runtime messages', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'squadforge-cron-'));
    let leader = null;

    try {
        const agentsDir = join(rootDir, 'agents');
        mkdirSync(agentsDir, { recursive: true });

        writeFileSync(join(agentsDir, 'leader.md'), `---
name: Leader
description: Cron test leader.
allowed_tools:
  - cron_create
  - cron_list
  - cron_get
  - cron_update
  - cron_delete
---

Manage crons and process cron-delivered system messages.`);

        writeFileSync(join(agentsDir, 'worker.md'), `---
name: Worker
description: Placeholder subagent for loader validation.
---

This test agent should never run.`);

        leader = await forge({
            rootDir,
            llm: new CronEchoLlm(),
            appName: 'squadforge-cron-test',
            pollTimeoutMs: 10,
            maxRuntimeMs: 15_000,
            wrapUpThresholdMs: 1_000
        });

        const cronCreateTool = leader.getTool('cron_create');
        const cronListTool = leader.getTool('cron_list');
        const cronGetTool = leader.getTool('cron_get');
        const cronUpdateTool = leader.getTool('cron_update');
        const cronDeleteTool = leader.getTool('cron_delete');

        const createdCron = await cronCreateTool.execute({
            name: 'Morning reminder',
            schedule: '0 9 * * *',
            message: 'Original cron message'
        }, {
            runtime: leader.runtime,
            sessionId: leader.sessionId
        });

        assert.equal(createdCron.success, true);
        assert.equal(typeof createdCron.output.cronId, 'string');

        const cronId = createdCron.output.cronId;
        const cronFilePath = join(rootDir, 'crons', `${cronId}.json`);

        assert.equal(existsSync(cronFilePath), true);

        const listBeforeUpdate = await cronListTool.execute({}, {
            runtime: leader.runtime
        });

        assert.equal(listBeforeUpdate.success, true);
        assert.equal(Array.isArray(listBeforeUpdate.output), true);
        assert.equal(listBeforeUpdate.output.length, 1);
        assert.equal(listBeforeUpdate.output[0].id, cronId);
        assert.equal(listBeforeUpdate.output[0].name, 'Morning reminder');
        assert.equal(listBeforeUpdate.output[0].schedule, '0 9 * * *');

        const cronDetailsBeforeUpdate = await cronGetTool.execute({
            cronId
        }, {
            runtime: leader.runtime
        });

        assert.equal(cronDetailsBeforeUpdate.success, true);
        assert.equal(cronDetailsBeforeUpdate.output.id, cronId);
        assert.equal(cronDetailsBeforeUpdate.output.name, 'Morning reminder');
        assert.equal(cronDetailsBeforeUpdate.output.schedule, '0 9 * * *');
        assert.equal(cronDetailsBeforeUpdate.output.message, 'Original cron message');
        assert.equal(cronDetailsBeforeUpdate.output.sessionId, leader.sessionId);
        assert.equal('task' in cronDetailsBeforeUpdate.output, false);

        const updatedCron = await cronUpdateTool.execute({
            cronId,
            name: 'Evening reminder',
            schedule: '0 18 * * *',
            message: 'Updated cron message'
        }, {
            runtime: leader.runtime,
            sessionId: leader.sessionId
        });

        assert.equal(updatedCron.success, true);

        const cronDetailsAfterUpdate = await cronGetTool.execute({
            cronId
        }, {
            runtime: leader.runtime
        });

        assert.equal(cronDetailsAfterUpdate.success, true);
        assert.equal(cronDetailsAfterUpdate.output.name, 'Evening reminder');
        assert.equal(cronDetailsAfterUpdate.output.schedule, '0 18 * * *');
        assert.equal(cronDetailsAfterUpdate.output.message, 'Updated cron message');

        const persistedCron = JSON.parse(readFileSync(cronFilePath, 'utf-8'));
        assert.equal(persistedCron.name, 'Evening reminder');
        assert.equal(persistedCron.schedule, '0 18 * * *');
        assert.equal(persistedCron.message, 'Updated cron message');
        assert.equal(persistedCron.sessionId, leader.sessionId);

        const outboundMessages = [];
        leader.sendMessage(async message => {
            outboundMessages.push(message);
        });

        await leader.start();

        const executedCron = await leader.runtime.cronManager.executeCron(cronId);
        assert.ok(executedCron);
        assert.equal(executedCron.id, cronId);
        assert.equal(executedCron.message, 'Updated cron message');

        const outboundCronMessage = await waitFor(() => {
            return outboundMessages.find(message => message.content === 'Handled cron message: Updated cron message');
        });

        assert.equal(outboundCronMessage.sessionId, leader.sessionId);
        assert.equal(outboundCronMessage.role, 'assistant');
        assert.equal(outboundCronMessage.timedOut, false);

        const leaderMessages = leader.getMessages();
        const runtimeQueuedMessage = [...leaderMessages]
            .reverse()
            .find(message => message.role === 'system' && message.content === 'Updated cron message');

        assert.ok(runtimeQueuedMessage, 'Expected the cron message to be appended to the leader session.');

        const deletedCron = await cronDeleteTool.execute({
            cronId
        }, {
            runtime: leader.runtime
        });

        assert.equal(deletedCron.success, true);
        assert.equal(existsSync(cronFilePath), false);

        const listAfterDelete = await cronListTool.execute({}, {
            runtime: leader.runtime
        });

        assert.equal(listAfterDelete.success, true);
        assert.equal(listAfterDelete.output, 'No scheduled crons found.');
    } finally {
        if (leader) {
            await leader.stop();
        }

        rmSync(rootDir, { recursive: true, force: true });
    }
});