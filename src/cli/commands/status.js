import { existsSync } from 'fs';
import { resolveLogFiles } from '../../../squadforge/src/index.js';
import { APP_ROOT_DIR } from '../../config.js';
import { loadConfig, validateConfig } from '../../config/config.js';
import { basicLog, header, info, success } from '../../utils/common/print.js';
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

            const { logsDir, logFilePath, errorLogFilePath } = resolveLogFiles({ rootDir: APP_ROOT_DIR });
            header('📚  Runtime logs');
            info(`Logs directory: ${logsDir}`);
            info(`Main log file: ${logFilePath} ${existsSync(logFilePath) ? '(present)' : '(not created yet)'}`);
            info(`Error log file: ${errorLogFilePath} ${existsSync(errorLogFilePath) ? '(present)' : '(not created yet)'}`);
            info("Use 'picobot logs' or 'picobot logs --errors' to inspect them.");

            // Validate the config
            const validatedConfig = validateConfig({ config });
            if (!validatedConfig) {
                process.exit(1);
            }

            // Final success message
            success('All configuration files are present and valid!');
        });
};