import { logger } from '../../utils/logger.js';

// In-memory registry of running/completed subagent tasks
// Map<taskId, { agentId, agentName, status, result, error, startedAt, completedAt }>
const tasks = new Map();

// Possible task statuses
export const TaskStatus = {
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// Register a new subagent task as running
export const registerTask = (taskId, { agentId, agentName, sessionId, task }) => {
    tasks.set(taskId, {
        agentId,
        agentName,
        sessionId,
        task,
        status: TaskStatus.RUNNING,
        result: null,
        error: null,
        startedAt: Date.now(),
        completedAt: null
    });
    logger.debug(`Registered subagent task ${taskId} (${agentName})`);
};

// Mark a task as completed with a result
export const completeTask = (taskId, result) => {
    const task = tasks.get(taskId);
    if (!task) {
        logger.warn(`Tried to complete unknown task ${taskId}`);
        return;
    }
    task.status = TaskStatus.COMPLETED;
    task.result = result;
    task.error = null;
    task.completedAt = Date.now();
    logger.debug(`Subagent task ${taskId} completed`);
};

// Mark a task as failed with an error
export const failTask = (taskId, error) => {
    const task = tasks.get(taskId);
    if (!task) {
        logger.warn(`Tried to fail unknown task ${taskId}`);
        return;
    }
    task.status = TaskStatus.FAILED;
    task.error = error;
    task.result = null;
    task.completedAt = Date.now();
    logger.debug(`Subagent task ${taskId} failed: ${error}`);
};

// Get a specific task by ID
export const getTask = taskId => {
    return tasks.get(taskId);
};

// Get all tasks (optionally filtered by status)
export const getTasks = (statusFilter) => {
    const result = [];
    for (const [taskId, task] of tasks) {
        if (!statusFilter || task.status === statusFilter) {
            result.push({ taskId, ...task });
        }
    }
    return result;
};

// Format a task for display to the LLM
export const formatTaskSummary = (taskId, task) => {
    const elapsed = task.completedAt
        ? `${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s`
        : `${((Date.now() - task.startedAt) / 1000).toFixed(1)}s (ongoing)`;

    const base = {
        task_id: taskId,
        agent: task.agentName,
        agent_id: task.agentId,
        status: task.status,
        original_task: task.task,
        elapsed
    };

    if (task.status === TaskStatus.COMPLETED) {
        base.result = task.result;
    } else if (task.status === TaskStatus.FAILED) {
        base.error = task.error;
    }

    return base;
};
