import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { loadCronsFromFiles } from './persistent.js';
import { pushInbound } from '../bus/message-bus.js';
import { Agent } from '../agent/agent.js';
import { buildSystemPrompt } from '../agent/prompts.js';
import { generateUniqueId } from '../utils/utils.js';

// In-memory storage for scheduled crons
export const crons = new Map();

// Stored main agent reference for running agent_prompt crons
let cronAgent = null;

// Set the agent instance (called once after the main agent is created)
export const setCronAgent = agent => {
    cronAgent = agent;
    logger.debug('Agent reference set for cron manager');
};

// Serialize cron for external use (excludes task reference)
export const serializeCron = cronEntry => ({
    id: cronEntry.id,
    name: cronEntry.name,
    schedule: cronEntry.schedule,
    action: cronEntry.action,
    chatId: cronEntry.chatId,
    channel: cronEntry.channel,
    message: cronEntry.message
});

// Initialize cron manager - loads crons from disk and schedules them
export const initializeCronManager = () => {
    try {
        // Load crons from persistent storage
        const loadedCrons = loadCronsFromFiles();

        // Schedule each loaded cron
        for (const [cronId, cronData] of loadedCrons) {
            try {
                // Validate cron expression
                if (!cron.validate(cronData.schedule)) {
                    logger.error(`Invalid cron schedule for cron ${cronId}: ${cronData.schedule}`);
                    continue;
                }

                // Create the scheduled task
                const task = cron.schedule(cronData.schedule, async () => {
                    await executeCron(cronId);
                });

                // Store cron with task reference
                crons.set(cronId, {
                    ...cronData,
                    task
                });

                // Log scheduled cron
                logger.info(`Scheduled cron: ${cronData.name} (${cronData.schedule})`);
            } catch (error) {
                logger.error(`Failed to schedule cron ${cronId}: ${error.message}`);
            }
        }

        // Log initialization result
        logger.info(`Cron manager initialized with ${crons.size} crons`);
    } catch (error) {
        logger.error(`Failed to initialize cron manager: ${error.message}`);
    }
};

// Execute a cron by ID
export const executeCron = async cronId => {
    // Get cron details
    const cronEntry = crons.get(cronId);
    if (!cronEntry) {
        logger.error(`Cron not found: ${cronId}`);
        return;
    }

    // Log cron execution start
    logger.info(`Executing cron: ${cronEntry.name}`);

    try {
        // Execute the cron action based on action type
        switch (cronEntry.action) {
            // Message action - push through the main agent as a system notification
            case 'message':
                pushInbound({
                    sessionKey: `${cronEntry.channel}_${cronEntry.chatId}`,
                    role: 'system',
                    content: JSON.stringify({
                        type: 'cron_notification',
                        action: 'message',
                        cron: cronEntry.name,
                        schedule: cronEntry.schedule,
                        content: cronEntry.message,
                        instruction: 'This is a simple scheduled message. Forward this message to the user as-is.'
                    })
                });
                break;

            // Agent prompt action - run agent in an isolated session and deliver the result
            case 'agent_prompt':
                await executeAgentPromptCron(cronEntry);
                break;

            // Unknown action type
            default:
                logger.warn(`Unknown cron action type: ${cronEntry.action}`);
        }

        // Log cron completion
        logger.info(`Cron completed: ${cronEntry.name}`);
    } catch (error) {
        logger.error(`Cron execution failed (${cronEntry.name}): ${error.message}`);
    }
};

// Execute an agent_prompt cron in an isolated session
const executeAgentPromptCron = async cronEntry => {
    // Validate agent reference is available
    if (!cronAgent) {
        logger.error(`Cannot execute agent_prompt cron "${cronEntry.name}": agent not set`);
        return;
    }

    // Create isolated session for this cron execution
    const cronSessionKey = generateUniqueId('cron');
    const userSessionKey = `${cronEntry.channel}_${cronEntry.chatId}`;
    logger.info(`Running agent_prompt cron "${cronEntry.name}" in isolated session: ${cronSessionKey}`);

    try {
        // Create a temporary agent instance with same LLM/model as the main agent
        const agent = new Agent({ llm: cronAgent.llm, model: cronAgent.model });

        // Build context from the main agent, scoped to the user's session
        const context = cronAgent.buildContext({ sessionKey: userSessionKey });

        // Run the cron task using the unified runTask flow
        const result = await agent.runTask({
            sessionKey: cronSessionKey,
            systemPromptBuilder: () => buildSystemPrompt(),
            userMessage: cronEntry.message,
            messageRole: 'system',
            tools: cronAgent.mainToolDefs,
            context
        });

        // Push the result into the main agent's session as a system message
        if (result.response) {
            pushInbound({
                sessionKey: userSessionKey,
                role: 'system',
                content: JSON.stringify({
                    type: 'cron_notification',
                    action: 'agent_prompt',
                    cron: cronEntry.name,
                    schedule: cronEntry.schedule,
                    content: result.response,
                    instruction: 'A scheduled agent task has completed. Relay the result to the user.'
                })
            });
        } else if (result.timedOut) {
            logger.warn(`Agent_prompt cron "${cronEntry.name}" timed out`);
            pushInbound({
                sessionKey: userSessionKey,
                role: 'system',
                content: JSON.stringify({
                    type: 'cron_notification',
                    action: 'agent_prompt',
                    cron: cronEntry.name,
                    schedule: cronEntry.schedule,
                    content: 'Timed out before completing.',
                    instruction: 'A scheduled agent task ran out of time before completing. Inform the user.'
                })
            });
        }

        // Log completion
        logger.info(`Agent_prompt cron "${cronEntry.name}" finished in isolated session`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Agent_prompt cron "${cronEntry.name}" failed: ${errorMessage}`);

        // Notify main agent of the failure
        pushInbound({
            sessionKey: userSessionKey,
            role: 'system',
            content: JSON.stringify({
                type: 'cron_notification',
                action: 'agent_prompt',
                cron: cronEntry.name,
                schedule: cronEntry.schedule,
                content: `Error: ${errorMessage}`,
                instruction: 'A scheduled agent task failed. Inform the user of the error.'
            })
        });
    }
};