import { logger } from '../utils/logger.js';

// Possible task statuses
export const TaskStatus = {
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// Compact in-memory registry of subagent tasks
export class TaskRegistry {
    // List of tasks with their metadata, status, results, and errors
    #tasks = new Map();

    // Register a new task with its initial data
    register(id, data) {
        this.#tasks.set(id, { ...data, status: TaskStatus.RUNNING, result: null, error: null, startedAt: Date.now(), completedAt: null });
        logger.debug(`Registered subagent task ${id} (${data.agentName})`);
    }

    // Mark a task as completed with its result
    complete(id, result) {
        this.#update(id, { status: TaskStatus.COMPLETED, result, error: null });
        logger.debug(`Subagent task ${id} completed`);
    }

    // Mark a task as failed with its error
    fail(id, error) {
        this.#update(id, { status: TaskStatus.FAILED, error, result: null });
        logger.debug(`Subagent task ${id} failed: ${error}`);
    }

    // Retrieve a task by its ID
    get(id) {
        return this.#tasks.get(id);
    }

    // Retrieve all tasks, optionally filtered by status
    getAll(statusFilter) {
        const result = [];
        for (const [taskId, task] of this.#tasks) {
            if (!statusFilter || task.status === statusFilter) {
                result.push({ taskId, ...task });
            }
        }

        // Return tasks sorted by most recent first
        return result;
    }

    // Format a task's data for output, including elapsed time and conditionally including result/error
    format(taskId, task) {
        const elapsed = task.completedAt ? `${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s` : `${((Date.now() - task.startedAt) / 1000).toFixed(1)}s (ongoing)`;
        const base = { task_id: taskId, agent: task.agentName, agent_id: task.agentId, status: task.status, original_task: task.task, elapsed };

        // Include result or error only if the task is completed or failed, respectively
        if (task.status === TaskStatus.COMPLETED) {
            base.result = task.result;
        } else if (task.status === TaskStatus.FAILED) {
            base.error = task.error;
        }

        // Return the formatted task data without result/error for running tasks to save space and avoid confusion
        return base;
    }

    // Internal method to update a task's fields and set completedAt timestamp
    #update(id, fields) {
        // Get the existing task to update
        const task = this.#tasks.get(id);
        if (!task) {
            logger.warn(`Tried to update unknown task ${id}`);
            return;
        }

        // Update the task with new fields and set completedAt if it's now completed or failed
        Object.assign(task, fields, { completedAt: Date.now() });
    }
}