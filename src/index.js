import 'dotenv/config';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { OpenRouterLlm, forge } from '../squadforge/src/index.js';
import { initTelegram, startTelegram, stopTelegram } from './channel/telegram-squadforge.js';
import { initLogger, logger } from './utils/common/logger.js';
import { getConfig } from './config/config.js';
import { initializeGoogleClients } from './utils/google/google-client.js';
import { SESSIONS_DIR } from './config.js';
import { initializeCronManager, setCronAgent, stopCronManager } from './crons/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPOSITORY_ROOT_DIR = join(__dirname, '..');
const APP_ROOT_DIR = join(REPOSITORY_ROOT_DIR, 'app');
const APP_AGENTS_DIR = join(APP_ROOT_DIR, 'agents');
const APP_PROMPTS_DIR = join(APP_ROOT_DIR, 'prompts');
const APP_SKILLS_DIR = join(APP_ROOT_DIR, 'skills');
const APP_TOOLS_DIR = join(APP_ROOT_DIR, 'tools');

let agent = null; // Active agent instance (accessible for commands like /model)
let stopping = false; // Flag to prevent multiple stop attempts

// Get the active agent instance
export const getAgent = () => {
    return agent;
};

// Resolve the committed Pico app directories used by Squadforge.
export const getPicoAppPaths = () => {
    return {
        rootDir: APP_ROOT_DIR,
        agentsDir: APP_AGENTS_DIR,
        promptsDir: APP_PROMPTS_DIR,
        skillsDir: APP_SKILLS_DIR,
        toolsDir: APP_TOOLS_DIR
    };
};

// Create the Squadforge leader agent configured to run Pico's committed app content.
export const createPicoSquadforgeLeader = async ({ llm, model, workspacePath }) => {
    const picoApp = getPicoAppPaths();

    return forge({
        rootDir: workspacePath,
        agentsDir: picoApp.agentsDir,
        promptsDir: picoApp.promptsDir,
        skillsDir: picoApp.skillsDir,
        toolsDir: picoApp.toolsDir,
        sessionsDir: SESSIONS_DIR,
        llm,
        model
    });
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

    setCronAgent(agent);
    initializeCronManager();

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
        stopCronManager();
        await agent?.stop();
    } catch (error) {
        logger.error(`Shutdown error: ${error}`);
    } finally {
        agent = null;
        stopping = false;
    }
};