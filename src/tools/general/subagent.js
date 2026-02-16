import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { getAgentIds } from '../../agent/agents.js';

// Subagent tool
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

    // Main execution function
    execute: async (args, context) => {
        // Extract parameters
        const { agent: agentId, task, task_id: existingTaskId } = args;

        try {
            // Launch the subagent
            const { taskId, agentName } = context.launchSubagent(agentId, task, existingTaskId, context.sessionKey);

            // Return the task ID immediately for asynchronous tracking
            return handleToolResponse({
                task_id: taskId,
                agent: agentName,
                status: 'launched',
                message: `Subagent "${agentName}" has been launched in the background. You will be notified automatically when it finishes. You can also use check_subagent with task_id "${taskId}" to check progress at any time.`
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to launch subagent' });
        }
    }
};