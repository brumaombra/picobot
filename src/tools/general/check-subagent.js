import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { TaskStatus } from '../../agent/task-registry.js';

// Check subagent tool — lets the main agent query the status/results of background subagent tasks
export const checkSubagentTool = {
    // Tool definition
    name: 'check_subagent',
    description: 'Check the status or retrieve results of background subagent tasks. Call with a specific task_id to get that task\'s status/result, or call without arguments to list all tasks.',
    parameters: {
        type: 'object',
        properties: {
            task_id: {
                type: 'string',
                description: 'Optional. The task_id returned by the subagent tool. If omitted, returns a summary of all tasks.'
            }
        },
        required: []
    },

    // Execution function
    execute: async (args, context) => {
        const { task_id: taskId } = args;

        if (!context?.taskRegistry) {
            return handleToolError({ message: 'Task registry not available in this context' });
        }

        // If a specific task is requested, return its details
        if (taskId) {
            const task = context.taskRegistry.get(taskId);
            if (!task) {
                return handleToolError({ message: `Unknown task_id "${taskId}". Use check_subagent without arguments to list all tasks.` });
            }
            return handleToolResponse(context.taskRegistry.format(taskId, task));
        }

        // No specific task — return a summary of all tasks
        const allTasks = context.taskRegistry.getAll();
        if (allTasks.length === 0) {
            return handleToolResponse({ message: 'No subagent tasks found. No subagents have been launched yet.' });
        }

        // Format all tasks into summaries
        const summaries = allTasks.map(({ taskId: id, ...task }) => context.taskRegistry.format(id, task));

        // Group by status for readability
        const running = summaries.filter(t => t.status === TaskStatus.RUNNING);
        const completed = summaries.filter(t => t.status === TaskStatus.COMPLETED);
        const failed = summaries.filter(t => t.status === TaskStatus.FAILED);

        // Return the formatted response
        return handleToolResponse({
            total: summaries.length,
            running: running.length,
            completed: completed.length,
            failed: failed.length,
            tasks: summaries
        });
    }
};