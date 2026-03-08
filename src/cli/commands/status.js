import { loadConfig, validateConfig } from '../../config/config.js';
import { basicLog, header, success } from '../../utils/common/print.js';
import { checkIfConfigFilesExist } from '../../files/files.js';

// Register the status command
export const registerStatusCommand = ({ program }) => {
    program
        .command('status')
        .description('Check Picobot status and configuration')
        .action(() => {
            // Print status header
            header('🩺  Picobot status check...');

            // Check if the config files and directories exist
            const allConfigFilesExist = checkIfConfigFilesExist();
            if (!allConfigFilesExist) {
                process.exit(1);
            }

            // Load the config
            const config = loadConfig();
            if (!config) {
                process.exit(1);
            }

            // Hide sensitive values
            const safeConfig = {
                ...config,
                telegram: {
                    ...config.telegram,
                    token: config.telegram?.token ? '***' : '(not set)'
                },
                openRouter: {
                    ...config.openRouter,
                    apiKey: config.openRouter?.apiKey ? '***' : '(not set)'
                },
                brave: {
                    ...config.brave,
                    apiKey: config.brave?.apiKey ? '***' : '(not set)'
                },
                googleAi: {
                    ...config.googleAi,
                    apiKey: config.googleAi?.apiKey ? '***' : '(not set)'
                },
                nvr: {
                    ...config.nvr,
                    password: config.nvr?.password ? '***' : '(not set)'
                }
            };

            // Display the config
            const stringConfig = JSON.stringify(safeConfig, null, 2);
            header('⚙️  Current configuration');
            basicLog(`${stringConfig}\n`);

            // Validate the config
            const validatedConfig = validateConfig({ config });
            if (!validatedConfig) {
                process.exit(1);
            }

            // Final success message
            success('All configuration files are present and valid!');
        });
};