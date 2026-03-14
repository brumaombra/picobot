import 'dotenv/config';
import { OpenRouterLlm, forge, logger } from '../squadforge/src/index.js';
import { initTelegram, startTelegram, stopTelegram } from './channel/telegram/telegram.js';
import { getConfig } from './config/config.js';
import { initializeGoogleClients } from './utils/google/google-client.js';
import { APP_ROOT_DIR } from './config.js';

let agent = null; // Active agent instance (accessible for commands like /model)
let stopping = false; // Flag to prevent multiple stop attempts

// Get the active agent instance
export const getAgent = () => {
    return agent;
};

// Start the Picobot agent
export const startBot = async () => {
    // Get config
    const config = getConfig();

    // Create LLM provider
    const llm = new OpenRouterLlm({
        apiKey: config.openRouter?.apiKey
    });

    // Create Squadforge-backed leader agent
    agent = await forge({
        rootDir: APP_ROOT_DIR,
        workspaceDir: config.workspace,
        llm,
        model: config.agent?.model
    });

    // Initial log message
    logger.info('Picobot starting up...');

    // Initialize Google API clients after Squadforge logging is ready
    await initializeGoogleClients();

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
        throw error;
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