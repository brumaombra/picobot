import { Telegraf } from 'telegraf';
import { logger } from '../utils/logger.js';
import { markdownToTelegramHtml, splitMessageIntoChunks, parseSessionKey } from '../utils/utils.js';
import { onOutbound } from '../bus/message-bus.js';
import { getConfigValue } from '../config/config.js';
import { registerStartCommand } from './commands/start.js';
import { registerModelsCommand } from './commands/models.js';
import { registerModelCommand } from './commands/model.js';
import { registerNewCommand } from './commands/new.js';
import { registerTextHandler } from './commands/text.js';
import { stopTyping } from './helpers/typing.js';
import { authMiddleware } from './helpers/auth.js';
import { TELEGRAM_MAX_MESSAGE_LENGTH } from '../config.js';

// Telegram channel state
let bot = null;
let running = false;

// Set up message handlers
const setupHandlers = () => {
    // Apply authorization middleware to all updates
    const allowedUsers = getConfigValue('telegram.allowedUsers');
    bot.use((ctx, next) => authMiddleware(ctx, next, allowedUsers));

    // Register command handlers
    registerStartCommand(bot);
    registerModelsCommand(bot);
    registerModelCommand(bot);
    registerNewCommand(bot);
    registerTextHandler(bot);
};

// Set up outbound message listener
const setupOutboundListener = () => {
    onOutbound(async message => {
        // Parse session key to get channel and chatId
        const { channel, chatId } = parseSessionKey(message.sessionKey);

        // Only handle Telegram messages
        if (channel !== 'telegram') return;

        // Stop typing indicator before sending the response
        stopTyping(chatId);

        try {
            // Convert markdown to HTML for Telegram
            const htmlContent = markdownToTelegramHtml(message.content);

            // Split long messages (Telegram limit is 4096 characters)
            const chunks = splitMessageIntoChunks(htmlContent, TELEGRAM_MAX_MESSAGE_LENGTH);
            for (const chunk of chunks) {
                // Send each chunk
                await bot.telegram.sendMessage(chatId, chunk, {
                    parse_mode: 'HTML',
                    reply_parameters: message.replyToId ? { message_id: parseInt(message.replyToId, 10) } : undefined,
                });
            }

            // Log successful send
            logger.debug(`Sent message to ${message.sessionKey}`);
        } catch (error) {
            // Log the error
            logger.error(`Failed to send telegram message: ${error}`);

            try {
                // Try to send without HTML formatting as fallback
                await bot.telegram.sendMessage(chatId, message.content.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH));
            } catch (fallbackError) {
                logger.error(`Fallback send also failed: ${fallbackError}`);
            }
        }
    });
};

// Initialize the Telegram channel
export const initTelegram = () => {
    // Get token from config
    const token = getConfigValue('telegram.token');

    // Create the bot instance
    bot = new Telegraf(token);
    running = false;

    // Set up handlers
    setupHandlers();
    setupOutboundListener();
};

// Register bot commands with Telegram
const registerCommands = async () => {
    try {
        // Register commands with Telegram
        await bot.telegram.setMyCommands([
            { command: 'start', description: 'Start conversation with the bot' },
            { command: 'models', description: 'List available AI models' },
            { command: 'model', description: 'Switch to a specific model' },
            { command: 'new', description: 'Start a new conversation (clear history)' }
        ]);

        // Log success
        logger.info('Bot commands registered with Telegram');
    } catch (error) {
        logger.error(`Failed to register bot commands: ${error}`);
    }
};

// Start the Telegram bot
export const startTelegram = async () => {
    // If already running, do nothing
    if (running) return;

    // Log and start the bot
    logger.info('Starting Telegram bot...');
    running = true;

    // Launch bot (long polling)
    await bot.launch({
        dropPendingUpdates: true
    });

    // Log bot info
    const botInfo = await bot.telegram.getMe();
    logger.info(`Telegram bot @${botInfo.username} connected`);

    // Register commands with Telegram
    await registerCommands();
};

// Stop the Telegram bot
export const stopTelegram = async () => {
    // If not running, do nothing
    if (!running) return;

    // Log and stop the bot
    logger.info('Stopping Telegram bot...');
    running = false;
    bot.stop('SIGTERM');
};