import { clearSession } from '../../session/manager.js';
import { logger } from '../../utils/logger.js';

// Register the /new command handler
export const registerNewCommand = bot => {
    bot.command('new', async context => {
        // Extract chat details
        const chatId = context.chat.id.toString();
        const sessionKey = `telegram_${chatId}`;

        // Clear the session
        clearSession(sessionKey);

        // Send confirmation message
        await context.reply('🆕 Started a new conversation! Previous messages have been cleared.', {
            parse_mode: 'HTML'
        });

        // Log the action
        logger.info(`New session started for chat: ${chatId}`);
    });
};