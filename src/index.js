import { Llm } from './llm/llm.js';
import { Agent } from './agent/agent.js';
import { initTelegram, startTelegram, stopTelegram } from './channel/telegram.js';
import { initLogger, logger } from './utils/logger.js';
import { initSessionManager } from './session/manager.js';
import { initializeJobManager } from './jobs/manager.js';
import { getConfig } from './config/config.js';
import { initializeGoogleClients } from './utils/google-client.js';
import { loadAgents } from './agent/agents.js';

let agent = null; // Active agent instance (accessible for commands like /model)
let stopping = false; // Flag to prevent multiple stop attempts
let agentPromise = null; // Tracks background agent loop for graceful shutdown

// Get the active agent instance
export const getAgent = () => {
    return agent;
};

// Start the Picobot agent
export const startBot = async () => {
    // Initialize logger
    initLogger();

    // Initial log message
    logger.info('Picobot starting up...');

    // Initialize Google API clients
    await initializeGoogleClients();

    // Initialize session manager (load sessions from disk)
    initSessionManager();

    // Initialize job manager (load and schedule cron jobs from disk)
    initializeJobManager();

    // Load agent definitions from agents directory
    loadAgents();

    // Get config
    const config = getConfig();

    // Create LLM provider
    const llm = new Llm({
        apiKey: config.openRouter?.apiKey
    });

    // Create agent
    agent = new Agent({
        llm,
        model: config.agent?.model,
        workspacePath: config.workspace,
        config: config.agent
    });

    // Initialize Telegram channel
    initTelegram();

    // Handle graceful shutdown
    process.on('SIGINT', stopBot);
    process.on('SIGTERM', stopBot);

    // Start components
    try {
        // Start agent loop in background
        agentPromise = agent.start();

        // Start Telegram (this blocks)
        await startTelegram();

        // Wait for agent
        await agentPromise;
    } catch (error) {
        logger.error(`Fatal error: ${error}`);
        await stopBot();
    }
};

// Stop the Picobot agent
export const stopBot = async () => {
    if (stopping) return;
    stopping = true;
    logger.info('Shutting down...');

    try {
        agent?.stop();
        await stopTelegram();
        await agentPromise;
    } catch (error) {
        logger.error(`Shutdown error: ${error}`);
    } finally {
        stopping = false;
    }
};