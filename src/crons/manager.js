import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { loadCronsFromFiles } from './persistent.js';
import { sendOutbound } from '../bus/message-bus.js';
import { Agent } from '../agent/agent.js';
import { getOrCreateSession, addMessageToSession } from '../session/manager.js';
import { getToolsDefinitions } from '../tools/tools.js';
import { buildSystemPrompt, getMainAgentAllowedTools } from '../agent/prompts.js';
import { generateUniqueId } from '../utils/utils.js';

// In-memory storage for scheduled crons
export const crons = new Map();

// Stored agent context for running agent_prompt crons
let agentContext = null;

// Set the agent context (called once after the main agent is created)
export const setAgentContext = ({ llm, model, workspacePath, config }) => {
    agentContext = { llm, model, workspacePath, config };
    logger.debug('Agent context set for cron manager');
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
            // Message action - sends a message via the message bus
            case 'message':
                // Send a message via message bus
                sendOutbound({
                    sessionKey: `${cronEntry.channel}_${cronEntry.chatId}`,
                    content: cronEntry.message
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
    // Validate agent context is available
    if (!agentContext) {
        logger.error(`Cannot execute agent_prompt cron "${cronEntry.name}": agent context not set`);
        return;
    }

    // Create isolated session for this cron execution
    const cronSessionKey = generateUniqueId('cron');
    const userSessionKey = `${cronEntry.channel}_${cronEntry.chatId}`;
    logger.info(`Running agent_prompt cron "${cronEntry.name}" in isolated session: ${cronSessionKey}`);

    try {
        // Create a temporary agent instance
        const agent = new Agent({
            llm: agentContext.llm,
            model: agentContext.model,
            skipMessageProcessor: true
        });

        // Initialize the isolated session with the main agent's system prompt
        const session = getOrCreateSession(cronSessionKey);
        if (session.messages.length === 0) {
            const systemPrompt = buildSystemPrompt();
            addMessageToSession(cronSessionKey, {
                role: 'system',
                content: systemPrompt
            });
        }

        // Add the cron's prompt as a user message
        addMessageToSession(cronSessionKey, {
            role: 'user',
            content: cronEntry.message
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
        const result = await agent.run(cronSessionKey, toolDefs, context);

        // Deliver the final response to the user's chat
        if (result.response) {
            sendOutbound({
                sessionKey: userSessionKey,
                content: result.response
            });
        } else if (result.timedOut) {
            logger.warn(`Agent_prompt cron "${cronEntry.name}" timed out`);
            sendOutbound({
                sessionKey: userSessionKey,
                content: `⏰ Scheduled task "${cronEntry.name}" ran out of time before completing.`
            });
        }

        // Log completion
        logger.info(`Agent_prompt cron "${cronEntry.name}" finished in isolated session`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Agent_prompt cron "${cronEntry.name}" failed: ${errorMessage}`);

        // Notify user of the failure
        sendOutbound({
            sessionKey: userSessionKey,
            content: `❌ Scheduled task "${cronEntry.name}" encountered an error: ${errorMessage}`
        });
    }
};
