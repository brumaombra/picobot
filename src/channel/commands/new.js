import { getAgent } from '../../index.js';
import { logger } from '../../../squadforge/src/index.js';

// Register the /new command handler
export const registerNewCommand = bot => {
    bot.command('new', async context => {
        // Extract chat details
        const chatId = context.chat.id.toString();
        const sessionKey = `telegram_${chatId}`;
        const agent = getAgent();

        if (!agent?.runtime?.sessionStore) {
            await context.reply('❌ Agent is not running yet. Start Picobot first, then try again.', {
                parse_mode: 'HTML'
            });
            return;
        }

        // Clear the session
        agent.runtime.sessionStore.clearSession(sessionKey);

        // Send confirmation message
        await context.reply('🆕 Started a new conversation! Previous messages have been cleared.', {
            parse_mode: 'HTML'
        });

        // Log the action
        logger.info(`New session started for chat: ${chatId}`);
    });
};