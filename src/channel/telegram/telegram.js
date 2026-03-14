import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { logger } from '../../../squadforge/src/index.js';
import { getConfigValue } from '../../config/config.js';
import { registerStartCommand } from '../commands/start.js';
import { registerModelsCommand } from '../commands/models.js';
import { registerModelCommand } from '../commands/model.js';
import { registerNewCommand } from '../commands/new.js';
import { stopTyping, startTyping } from '../helpers/typing.js';
import { authMiddleware } from '../helpers/auth.js';
import { buildMediaInboundMessage, buildTextInboundMessage, sendTelegramOutboundMessage } from './media.js';

let bot = null; // Telegraf bot
let running = false; // Polling flag
let inboundRuntimeHandler = null; // Runtime callback

// Forward one inbound message
const deliverInboundRuntimeMessage = message => {
    // Ignore messages before runtime attach
    if (typeof inboundRuntimeHandler !== 'function') {
        logger.warn('Received a Telegram message before the Squadforge runtime was attached.');
        return;
    }

    // Forward to runtime
    inboundRuntimeHandler(message);
};

// Register Telegram handlers
const setupHandlers = () => {
    // Apply allowlist middleware
    const allowedUsers = getConfigValue('telegram.allowedUsers');
    bot.use((context, next) => authMiddleware(context, next, allowedUsers));

    // Register slash commands
    registerStartCommand(bot);
    registerModelsCommand(bot);
    registerModelCommand(bot);
    registerNewCommand(bot);

    // Forward text messages
    bot.on(message('text'), async context => {
        const msg = context.message;
        const chatId = msg.chat.id.toString();

        // Start typing indicator
        startTyping(bot, chatId);
        deliverInboundRuntimeMessage(buildTextInboundMessage(msg));
    });

    // Forward supported media
    bot.on(message(), async context => {
        const msg = context.message;
        const chatId = msg.chat?.id?.toString();

        // Ignore unsupported updates
        if (!msg || !chatId || (!msg.photo && !msg.document && !msg.video && !msg.audio && !msg.voice && !msg.animation)) {
            return;
        }

        // Start typing indicator
        startTyping(bot, chatId);

        try {
            // Build and deliver media message
            const inboundMessage = await buildMediaInboundMessage({ bot, msg });
            if (inboundMessage) {
                deliverInboundRuntimeMessage(inboundMessage); // Forward to runtime
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to process inbound Telegram media: ${errorMessage}`);
            await context.reply(`Sorry, I couldn't process that media file: ${errorMessage}`);
        }
    });
};

// Register bot commands
const registerCommands = async () => {
    try {
        // Publish commands
        await bot.telegram.setMyCommands([
            { command: 'start', description: 'Start conversation with the bot' },
            { command: 'models', description: 'List available AI models' },
            { command: 'model', description: 'Switch to a specific model' },
            { command: 'new', description: 'Start a new conversation (clear history)' }
        ]);

        // Debug log
        logger.info('Bot commands registered with Telegram');
    } catch (error) {
        logger.error(`Failed to register bot commands: ${error}`);
    }
};

// Initialize the adapter
export const initTelegram = leaderAgent => {
    // Read bot token
    const token = getConfigValue('telegram.token');

    // Create Telegraf bot
    bot = new Telegraf(token);

    // Reset adapter state
    running = false;
    inboundRuntimeHandler = null;

    // Attach inbound bridge
    leaderAgent.onMessage(handler => {
        // Store runtime callback
        inboundRuntimeHandler = handler;

        // Clear callback on detach
        return () => {
            inboundRuntimeHandler = null;
        };
    });

    // Attach outbound bridge
    leaderAgent.sendMessage(message => {
        sendTelegramOutboundMessage({ bot, stopTyping, message, logger }); // Translate outbound message
    });

    // Register handlers
    setupHandlers();
};

// Start polling
export const startTelegram = async () => {
    // Skip if already running
    if (running) {
        return;
    }

    // Log and start polling
    logger.info('Starting Telegram bot...');
    running = true;

    // Launch polling
    await bot.launch({
        dropPendingUpdates: true
    });

    // Read bot info
    const botInfo = await bot.telegram.getMe();
    logger.info(`Telegram bot @${botInfo.username} connected`);

    // Publish commands
    await registerCommands();
};

// Stop polling
export const stopTelegram = async () => {
    // Skip if already stopped
    if (!running) {
        return;
    }

    // Log and stop polling
    logger.info('Stopping Telegram bot...');

    // Clear adapter state
    running = false;
    inboundRuntimeHandler = null;
    bot.stop('SIGTERM');
};