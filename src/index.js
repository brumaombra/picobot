import { Llm } from './llm/llm.js';
import { Agent } from './agent/agent.js';
import { initTelegram, startTelegram, stopTelegram } from './channel/telegram.js';
import { initLogger, logger } from './utils/logger.js';
import { initSessionManager } from './session/manager.js';
import { getConfig } from './config/config.js';
import { initializeGoogleClients } from './utils/google-client.js';

// Active agent instance (accessible for commands like /model)
let agent = null;

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
        config: config.agent,
        tools: {
            categories: ['general'] // Main agent only uses general toolset
        }
    });

    // Initialize Telegram channel
    initTelegram();

    // Handle graceful shutdown
    process.on('SIGINT', stopBot);
    process.on('SIGTERM', stopBot);

    // Start components
    try {
        // Start agent loop in background
        const agentPromise = agent.start();

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
    logger.info('Shutting down...');
    agent?.stop();
    await stopTelegram();
    process.exit(0);
};