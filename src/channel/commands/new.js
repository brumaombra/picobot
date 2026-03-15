import { getAgent } from '../../index.js';
import { logger } from '../../../squadforge/src/index.js';

// Register the /new command handler
export const registerNewCommand = bot => {
    bot.command('new', async context => {
        // Extract chat details
        const chatId = context.chat.id.toString();
        const sessionKey = `telegram_${chatId}`;
        const agent = getAgent();
        const sessionManager = agent?.sessionManager || null;

        // Ensure the main agent and session manager are available
        if (!agent || !sessionManager) {
            await context.reply('❌ Agent is not running yet. Start Picobot first, then try again.', { parse_mode: 'HTML' });
            return;
        }

        // Clear the session
        const existingSession = sessionManager.getSession(sessionKey);
        if (existingSession) {
            sessionManager.clearSession(sessionKey);
        }

        // Send confirmation message
        const replyText = existingSession?.messages?.length ? '🆕 Started a new conversation! Previous messages have been cleared.' : '🆕 Started a new conversation!';
        await context.reply(replyText, { parse_mode: 'HTML' });

        // Log the action
        logger.info(`New session started for chat: ${chatId}`);
    });
};