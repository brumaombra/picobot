import { TELEGRAM_WELCOME_MESSAGE } from '../../config.js';

// Register the /start command handler
export const registerStartCommand = bot => {
    bot.command('start', async context => {
        await context.reply(TELEGRAM_WELCOME_MESSAGE, { parse_mode: 'HTML' }); // Send welcome message
    });
};