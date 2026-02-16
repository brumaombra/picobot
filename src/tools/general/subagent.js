import { Agent } from '../../agent/agent.js';
import { generateUniqueId, handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { buildSubagentSystemPrompt } from '../../agent/prompts.js';
import { getToolsDefinitions } from '../tools.js';
import { getOrCreateSession, addMessageToSession } from '../../session/manager.js';
import { getAgent, getAgents, getAgentIds } from '../../agent/agents.js';
import { registerTask, completeTask, failTask, getTask } from './subagent-registry.js';
import { pushInbound } from '../../bus/message-bus.js';

// Subagent tool — launches subagents asynchronously and returns immediately
export const subagentTool = {
    // Tool definition
    name: 'subagent',
    description: 'Delegate a task to a specialized AI subagent for **asynchronous** execution. The subagent runs in the background and this tool returns immediately with a task_id. Use `check_subagent` to poll for status/results, or wait — you will be notified automatically when the subagent finishes. To resume a previous subagent session (e.g. to answer a clarification request), pass the task_id returned from the previous call.',
    get parameters() {
        return {
            type: 'object',
            properties: {
                agent: {
                    type: 'string',
                    enum: getAgentIds(),
                    description: 'The ID of the specialized agent to delegate to.'
                },
                task: {
                    type: 'string',
                    description: 'Detailed task description with all context and requirements. When resuming a session, this is your reply to the subagent\'s clarification question.'
                },
                task_id: {
                    type: 'string',
                    description: 'Optional. The task_id from a previous subagent call to resume that conversation (e.g. to answer a clarification request).'
                }
            },
            required: ['agent', 'task']
        };
    },

    // Main execution function — launches the subagent in the background and returns immediately
    execute: async (args, context) => {
        const { agent: agentId, task, task_id: existingTaskId } = args;

        // Validate context
        if (!context?.llm || !context?.model) {
            return handleToolError({ message: 'No LLM provider or model available in context' });
        }

        // Look up agent definition
        const agentDef = getAgent(agentId);
        if (!agentDef) {
            const available = [...getAgents().keys()].join(', ');
            return handleToolError({ message: `Unknown agent "${agentId}". Available agents: ${available}` });
        }

        // Use the same model as the parent agent
        const selectedModel = context.model;

        // Determine task ID and session ID (resume existing or create new)
        const existingTask = existingTaskId ? getTask(existingTaskId) : null;
        if (existingTaskId && !existingTask) {
            return handleToolError({ message: `Unknown task_id "${existingTaskId}". Use check_subagent to list all tasks.` });
        }
        const taskId = existingTaskId || generateUniqueId('task');
        const subagentId = existingTask?.sessionId || generateUniqueId('subagent');
        const isResuming = Boolean(existingTaskId);

        logger.info(`${isResuming ? 'Resuming' : 'Spawning'} subagent [${subagentId}] task [${taskId}]: ${agentDef.name} (model: ${selectedModel})`);

        try {
            // Create subagent
            const subagent = new Agent({
                llm: context.llm,
                model: selectedModel
            });

            // Initialize subagent session with system prompt built from agent definition
            const session = getOrCreateSession(subagentId);
            if (session.messages.length === 0) {
                const systemPrompt = buildSubagentSystemPrompt(agentDef);

                // Add system prompt to subagent session
                addMessageToSession(subagentId, {
                    role: 'system',
                    content: systemPrompt
                });
            }

            // Add user task to subagent session
            addMessageToSession(subagentId, {
                role: 'user',
                content: task
            });

            // Get tool definitions filtered to the agent's allowed tools only
            const toolDefinitions = getToolsDefinitions(agentDef.allowedTools);

            // Build execution context for subagent (no abort signal — subagent runs independently)
            const subagentContext = {
                workingDir: context.workingDir,
                sessionKey: context.sessionKey,
                llm: context.llm,
                model: selectedModel,
                config: context.config
            };

            // Register the task in the registry before launching
            registerTask(taskId, {
                agentId,
                agentName: agentDef.name,
                sessionId: subagentId,
                task
            });

            // Launch the subagent in the background (fire-and-forget)
            // The .then/.catch handlers update the registry and notify the main agent when done
            const parentSessionKey = context.sessionKey;
            subagent.run(subagentId, toolDefinitions, subagentContext)
                .then(result => {
                    logger.info(`Subagent [${subagentId}] task [${taskId}] completed: ${agentDef.name}`);

                    const status = result.response ? 'completed' : 'failed';
                    if (result.response) completeTask(taskId, result.response);
                    else failTask(taskId, result.timedOut ? 'Subagent timed out without completing the task.' : 'Subagent completed without producing a response.');

                    // Notify the main agent by pushing a synthetic inbound message
                    pushInbound({
                        sessionKey: parentSessionKey,
                        content: `[SYSTEM] Subagent task completed. Task ID: ${taskId} | Agent: ${agentDef.name} | Status: ${status}. Use check_subagent to retrieve the full result.`
                    });
                })
                .catch(error => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error(`Subagent [${subagentId}] task [${taskId}] failed: ${errorMessage}`);
                    failTask(taskId, errorMessage);

                    // Notify the main agent about the failure
                    pushInbound({
                        sessionKey: parentSessionKey,
                        content: `[SYSTEM] Subagent task failed. Task ID: ${taskId} | Agent: ${agentDef.name} | Error: ${errorMessage}. Use check_subagent to see details.`
                    });
                });

            // Return immediately with the task ID — don't wait for the subagent to finish
            return handleToolResponse({
                task_id: taskId,
                agent: agentDef.name,
                status: 'launched',
                message: `Subagent "${agentDef.name}" has been launched in the background. You will be notified automatically when it finishes. You can also use check_subagent with task_id "${taskId}" to check progress at any time.`
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to launch subagent' });
        }
    }
};