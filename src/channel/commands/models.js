import { OPENROUTER_MODELS } from '../../config.js';

// Register the /models command handler
export const registerModelsCommand = bot => {
    bot.command('models', async context => {
        // Format the models list with numbers
        const modelsList = OPENROUTER_MODELS.map((model, index) => `${index + 1}. ${model}`).join('\n');
        const message = `<b>Available OpenRouter Models:</b>\n\n${modelsList}\n\nUse <code>/model [number]</code> to switch models.`;

        // Send models list
        await context.reply(message, {
            parse_mode: 'HTML'
        });
    });
};