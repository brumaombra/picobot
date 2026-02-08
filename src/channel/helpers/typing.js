import { logger } from '../../utils/logger.js';
import { TELEGRAM_TYPING_INTERVAL_MS } from '../../config.js';

// Track active typing indicators by chatId
const typingIntervals = new Map();

// Start typing indicator for a chat
export const startTyping = async (bot, chatId) => {
    // Send initial typing action
    try {
        await bot.telegram.sendChatAction(chatId, 'typing');
    } catch (error) {
        logger.error(`Failed to send typing action: ${error}`);
        return;
    }

    // Clear any existing interval for this chat
    stopTyping(chatId);

    // Set up interval to keep typing indicator active (Telegram expires it after ~5 seconds)
    const intervalId = setInterval(async () => {
        try {
            await bot.telegram.sendChatAction(chatId, 'typing');
        } catch (error) {
            logger.error(`Failed to send typing action: ${error}`);
            stopTyping(chatId);
        }
    }, TELEGRAM_TYPING_INTERVAL_MS);

    // Store the interval ID
    typingIntervals.set(chatId, intervalId);
};

// Stop typing indicator for a chat
export const stopTyping = chatId => {
    const intervalId = typingIntervals.get(chatId);
    if (intervalId) {
        clearInterval(intervalId);
        typingIntervals.delete(chatId);
    }
};