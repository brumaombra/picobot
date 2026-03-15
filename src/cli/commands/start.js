import { startBot } from '../../index.js';
import { resolveLogFiles } from '../../../squadforge/src/index.js';
import { APP_ROOT_DIR } from '../../config.js';
import { loadConfig, validateConfig, setConfig } from '../../config/config.js';
import { error, header, logo, suggestion } from '../../utils/common/print.js';
import { checkIfConfigFilesExist } from '../../files/files.js';

// Register the start command
export const registerStartCommand = ({ program }) => {
    program
        .command('start')
        .description('Start the Picobot agent')
        .option('-c, --config <path>', 'Path to config file')
        .action(async options => {
            // Print logo and starting header
            logo();
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
                const { errorLogFilePath } = resolveLogFiles({ rootDir: APP_ROOT_DIR });
                error(`Failed to start Picobot: ${err}`);
                suggestion(`Check ${errorLogFilePath} or run 'picobot logs --errors' for details.`);
                process.exit(1);
            }
        });
};