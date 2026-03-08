import { createInterface } from 'node:readline';
import { loadConfig, writeConfig } from '../../config/config.js';
import { basicLog, header, info, listItem, success, warning, newline } from '../../utils/common/print.js';
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

				// Show current allowed users from config (if any) and prompt for updates
				let allowedUsers = Array.isArray(config.telegram?.allowedUsers) ? config.telegram.allowedUsers.map(user => String(user).trim()).filter(Boolean) : [];
				if (allowedUsers.length > 0) {
					info(`Current allowed users: [${allowedUsers.join(', ')}]`);
				}

				// Prompt for allowed users until at least one is provided
				while (allowedUsers.length === 0) {
					// Prompt for allowed users (comma-separated)
					const allowedUsersInput = await question('\nEnter allowed Telegram user IDs or @usernames (comma-separated, press Enter to keep current): ');
					const parsedUsers = allowedUsersInput
						.split(',')
						.map(user => user.trim())
						.filter(Boolean);

					// If input is provided, replace current list with parsed values
					if (parsedUsers.length > 0) {
						allowedUsers = parsedUsers;
					}

					// If no valid users entered, show warning and prompt again
					if (allowedUsers.length === 0) {
						warning('At least one allowed user is required. Please enter at least one Telegram user ID or @username.');
					}
				}

				// Set allowed users in config
				config.telegram.allowedUsers = allowedUsers;
				success(`Allowed users set: [${allowedUsers.join(', ')}]`);

				/************** Prompt for Brave Search API key (optional) **************/

				const braveApiKey = await question('\nEnter your Brave Search API key (optional, press Enter to skip): ');
				if (braveApiKey.trim()) {
					config.brave = { apiKey: braveApiKey.trim() };
					success('Brave Search API key saved');
				} else {
					info('Brave Search API key skipped (web search tools will be unavailable)');
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