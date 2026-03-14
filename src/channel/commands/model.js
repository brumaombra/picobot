import { getAgent } from '../../index.js';
import { OPENROUTER_MODELS } from '../../config.js';

// Register the /model command handler
export const registerModelCommand = bot => {
    bot.command('model', async context => {
        const agent = getAgent();
        const runtime = agent?.runtime || null;

        // Ensure the main agent is available
        if (!agent || !runtime) {
            await context.reply('❌ Agent is not running yet. Start Picobot first, then try again.', { parse_mode: 'HTML' });
            return;
        }

        // Get the model identifier from the command arguments
        const args = context.message.text.split(' ').slice(1);
        const modelInput = args.join(' ').trim();

        // If no model argument is provided, show the current model
        if (!modelInput) {
            const currentModel = agent.model;
            await context.reply(`🤖 Current model: <code>${currentModel}</code>.`, { parse_mode: 'HTML' });
            return;
        }

        // Parse the model number
        const modelNumber = parseInt(modelInput, 10);
        if (isNaN(modelNumber) || modelNumber < 1 || modelNumber > OPENROUTER_MODELS.length) {
            await context.reply(`❌ Invalid model number. Please use a number between 1 and ${OPENROUTER_MODELS.length}.\n\nUse <code>/models</code> to see available models.`, { parse_mode: 'HTML' });
            return;
        }

        // Convert number to model name (1-based indexing)
        const modelName = OPENROUTER_MODELS[modelNumber - 1];

        try {
            // Validate model
            if (!OPENROUTER_MODELS.includes(modelName)) {
                await context.reply(`❌ Invalid model: ${modelName}`, { parse_mode: 'HTML' });
                return;
            }

            // Update agent model
            runtime.model = modelName;

            // Send success message
            await context.reply(`✅ Model switched to: <code>${modelName}</code>`, { parse_mode: 'HTML' }); // Send success message
        } catch (error) {
            await context.reply(`❌ Error: ${error.message}`, { parse_mode: 'HTML' }); // Send error message
        }
    });
};