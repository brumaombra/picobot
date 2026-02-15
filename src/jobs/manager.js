import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { loadJobsFromFiles } from './persistent.js';
import { sendOutbound } from '../bus/message-bus.js';
import { Agent } from '../agent/agent.js';
import { getOrCreateSession, addMessageToSession } from '../session/manager.js';
import { getToolsDefinitions } from '../tools/tools.js';
import { buildSystemPrompt, getMainAgentAllowedTools } from '../agent/prompts.js';
import { generateUniqueId } from '../utils/utils.js';

// In-memory storage for scheduled jobs
export const jobs = new Map();

// Stored agent context for running agent_prompt jobs
let agentContext = null;

// Set the agent context (called once after the main agent is created)
export const setAgentContext = ({ llm, model, workspacePath, config }) => {
    agentContext = { llm, model, workspacePath, config };
    logger.debug('Agent context set for job manager');
};

// Serialize job for external use (excludes task reference)
export const serializeJob = job => ({
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    action: job.action,
    chatId: job.chatId,
    channel: job.channel,
    message: job.message
});

// Initialize job manager - loads jobs from disk and schedules them
export const initializeJobManager = () => {
    try {
        // Load jobs from persistent storage
        const loadedJobs = loadJobsFromFiles();

        // Schedule each loaded job
        for (const [jobId, jobData] of loadedJobs) {
            try {
                // Validate cron expression
                if (!cron.validate(jobData.schedule)) {
                    logger.error(`Invalid cron schedule for job ${jobId}: ${jobData.schedule}`);
                    continue;
                }

                // Create the scheduled task
                const task = cron.schedule(jobData.schedule, async () => {
                    await executeJob(jobId);
                });

                // Store job with task reference
                jobs.set(jobId, {
                    ...jobData,
                    task
                });

                // Log scheduled job
                logger.info(`Scheduled job: ${jobData.name} (${jobData.schedule})`);
            } catch (error) {
                logger.error(`Failed to schedule job ${jobId}: ${error.message}`);
            }
        }

        // Log initialization result
        logger.info(`Job manager initialized with ${jobs.size} jobs`);
    } catch (error) {
        logger.error(`Failed to initialize job manager: ${error.message}`);
    }
};

// Execute a job by ID
export const executeJob = async jobId => {
    // Get job details
    const job = jobs.get(jobId);
    if (!job) {
        logger.error(`Job not found: ${jobId}`);
        return;
    }

    // Log job execution start
    logger.info(`Executing job: ${job.name}`);

    try {
        // Execute the job action based on action type
        switch (job.action) {
            // Message action - sends a message via the message bus
            case 'message':
                // Send a message via message bus
                sendOutbound({
                    sessionKey: `${job.channel}_${job.chatId}`,
                    content: job.message
                });
                break;

            // Agent prompt action - run agent in an isolated session and deliver the result
            case 'agent_prompt':
                await executeAgentPromptJob(job);
                break;

            // Unknown action type
            default:
                logger.warn(`Unknown job action type: ${job.action}`);
        }

        // Log job completion
        logger.info(`Job completed: ${job.name}`);
    } catch (error) {
        logger.error(`Job execution failed (${job.name}): ${error.message}`);
    }
};

// Execute an agent_prompt job in an isolated session
const executeAgentPromptJob = async job => {
    // Validate agent context is available
    if (!agentContext) {
        logger.error(`Cannot execute agent_prompt job "${job.name}": agent context not set`);
        return;
    }

    // Create isolated session for this job execution
    const jobSessionKey = generateUniqueId('job');
    const userSessionKey = `${job.channel}_${job.chatId}`;
    logger.info(`Running agent_prompt job "${job.name}" in isolated session: ${jobSessionKey}`);

    try {
        // Create a temporary agent instance
        const agent = new Agent({
            llm: agentContext.llm,
            model: agentContext.model,
            skipMessageProcessor: true
        });

        // Initialize the isolated session with the main agent's system prompt
        const session = getOrCreateSession(jobSessionKey);
        if (session.messages.length === 0) {
            const systemPrompt = buildSystemPrompt();
            addMessageToSession(jobSessionKey, {
                role: 'system',
                content: systemPrompt
            });
        }

        // Add the job's prompt as a user message
        addMessageToSession(jobSessionKey, {
            role: 'user',
            content: job.message
        });

        // Get tool definitions for the main agent
        const toolDefs = getToolsDefinitions(getMainAgentAllowedTools());

        // Build execution context
        const context = {
            workingDir: agentContext.workspacePath,
            sessionKey: userSessionKey,
            llm: agentContext.llm,
            model: agentContext.model,
            config: agentContext.config
        };

        // Run the agent loop in the isolated session
        const result = await agent.run(jobSessionKey, toolDefs, context);

        // Deliver the final response to the user's chat
        if (result.response) {
            sendOutbound({
                sessionKey: userSessionKey,
                content: result.response
            });
        } else if (result.timedOut) {
            logger.warn(`Agent_prompt job "${job.name}" timed out`);
            sendOutbound({
                sessionKey: userSessionKey,
                content: `⏰ Scheduled task "${job.name}" ran out of time before completing.`
            });
        }

        // Log completion
        logger.info(`Agent_prompt job "${job.name}" finished in isolated session`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Agent_prompt job "${job.name}" failed: ${errorMessage}`);

        // Notify user of the failure
        sendOutbound({
            sessionKey: userSessionKey,
            content: `❌ Scheduled task "${job.name}" encountered an error: ${errorMessage}`
        });
    }
};