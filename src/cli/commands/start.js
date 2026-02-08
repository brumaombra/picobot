import { startBot } from '../../index.js';
import { loadConfig, validateConfig, setConfig } from '../../config/config.js';
import { error, header } from '../../utils/print.js';
import { checkIfConfigFilesExist } from '../../files/files.js';

// Register the start command
export const registerStartCommand = ({ program }) => {
    program
        .command('start')
        .description('Start the Picobot agent')
        .option('-c, --config <path>', 'Path to config file')
        .action(async options => {
            // Print starting header
            header('🤖  Picobot starting...');

            // Check if the config files and directories exist
            const allConfigFilesExist = checkIfConfigFilesExist();
            if (!allConfigFilesExist) {
                process.exit(1);
            }

            // Load the config
            const config = loadConfig({ filePath: options.config });
            if (!config) {
                process.exit(1);
            }

            // Validate the config
            const validatedConfig = validateConfig({ config });
            if (!validatedConfig) {
                process.exit(1);
            }

            // Store config globally
            setConfig(validatedConfig);

            try {
                await startBot(); // Start the bot
            } catch (err) {
                error(`Failed to start Picobot: ${err}`);
                process.exit(1);
            }
        });
};