import 'dotenv/config';
import { OpenRouterLlm } from '../squadforge/src/index.js';
import { initTelegram, startTelegram, stopTelegram } from './channel/telegram-squadforge.js';
import { initLogger, logger } from './utils/common/logger.js';
import { getConfig } from './config/config.js';
import { initializeGoogleClients } from './utils/google/google-client.js';
import { createPicoSquadforgeLeader } from './squadforge/pico-runtime.js';

let agent = null; // Active agent instance (accessible for commands like /model)
let stopping = false; // Flag to prevent multiple stop attempts

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

    // Get config
    const config = getConfig();

    // Create LLM provider
    const llm = new OpenRouterLlm({
        apiKey: config.openRouter?.apiKey
    });

    // Create Squadforge-backed leader agent
    agent = await createPicoSquadforgeLeader({
        llm,
        model: config.agent?.model,
        workspacePath: config.workspace
    });

    // Initialize Telegram channel
    initTelegram(agent);

    // Handle graceful shutdown
    process.on('SIGINT', stopBot);
    process.on('SIGTERM', stopBot);

    // Start components
    try {
        // Start the runtime before opening Telegram updates
        await agent.start();

        // Start Telegram polling
        await startTelegram();
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
        await stopTelegram();
        await agent?.stop();
    } catch (error) {
        logger.error(`Shutdown error: ${error}`);
    } finally {
        agent = null;
        stopping = false;
    }
};