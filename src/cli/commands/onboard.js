import { createInterface } from 'node:readline';
import { loadConfig, writeConfig } from '../../config/config.js';
import { basicLog, header, info, listItem, success, warning, newline } from '../../utils/print.js';
import { createConfigFiles } from '../../files/files.js';
import { CONFIG_PATH, OPENROUTER_MODELS } from '../../config.js';

// Register the onboard command
export const registerOnboardCommand = ({ program }) => {
	program
		.command('onboard')
		.description('Interactive onboarding wizard for Picobot setup')
		.action(async () => {
			// Print onboarding header
			header('🚀  Picobot onboarding wizard');

			// Create configuration files and directories
			createConfigFiles();

			// Load the current config
			const config = loadConfig();
			if (!config) {
				process.exit(1);
			}

			// Create readline interface
			const readline = createInterface({
				input: process.stdin,
				output: process.stdout
			});

			// Transform question to return a promise
			const question = query => {
				return new Promise(resolve => readline.question(query, resolve));
			};

			try {
				// Start onboarding prompts
				basicLog('\nLet\'s set up your Picobot configuration...\n');

				/******************************** Prompt section - Start ********************************/

				/************** Prompt for OpenRouter API key **************/

				const openrouterApiKey = await question('Enter your OpenRouter API key: ');
				if (openrouterApiKey.trim()) {
					config.openRouter.apiKey = openrouterApiKey.trim();
					success('OpenRouter API key saved');
				} else {
					warning('No OpenRouter API key entered');
				}

				/************** Prompt for model selection **************/

				// Print available models
				basicLog('\nAvailable models:');
				OPENROUTER_MODELS.forEach((model, index) => {
					const recommended = index === 0 ? ' (recommended)' : '';
					listItem(`${index + 1}. ${model}${recommended}`);
				});

				// Prompt for model selection
				const modelInput = await question('Enter the number of the model (or press Enter for 1): ');
				let selectedModel = OPENROUTER_MODELS[0]; // Default
				if (modelInput.trim()) {
					const modelIndex = parseInt(modelInput.trim()) - 1;
					if (modelIndex >= 0 && modelIndex < OPENROUTER_MODELS.length) {
						selectedModel = OPENROUTER_MODELS[modelIndex];
					}
				}

				// Set the selected model in config
				config.agent.model = selectedModel;
				success(`Model set to: ${selectedModel}`);

				/************** Prompt for Telegram bot token **************/

				const telegramToken = await question('\nEnter your Telegram bot token: ');
				if (telegramToken.trim()) {
					config.telegram.token = telegramToken.trim();
					success('Telegram bot token saved');
				} else {
					warning('No Telegram bot token entered');
				}

				/************** Prompt for allowed users **************/

				const allowedUsersInput = await question('\nEnter allowed Telegram user IDs (comma-separated, or leave empty for none): ');
				if (allowedUsersInput.trim()) {
					const allowedUsers = allowedUsersInput.split(',');
					config.telegram.allowedUsers = allowedUsers;
					success(`Allowed users set: [${allowedUsers.join(', ')}]`);
				} else {
					success('No allowed users set (bot will be open to all users)');
				}

				/******************************** Prompt section - End ********************************/

				// Save the updated config
				writeConfig(config);
				newline();
				success(`Configuration saved to ${CONFIG_PATH}`);

				// Final instructions
				newline();
				info('Setup complete! Next steps:');
				listItem('Run `picobot status` to verify your configuration', 1);
				listItem('Run `picobot start` to start the bot', 1);
				newline();
			} finally {
				readline.close();
			}
		});
};