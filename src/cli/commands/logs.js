import { existsSync } from 'fs';
import { readLogTail, resolveLogFiles } from '../../../squadforge/src/index.js';
import { APP_ROOT_DIR } from '../../config.js';
import { basicLog, header, info, warning } from '../../utils/common/print.js';

// Register the logs command
export const registerLogsCommand = ({ program }) => {
    program
        .command('logs')
        .description('Show recent Squadforge runtime logs')
        .option('-e, --errors', 'Show only the error log file')
        .option('-n, --lines <count>', 'Number of lines to show', '80')
        .action(options => {
            const { logFilePath, errorLogFilePath } = resolveLogFiles({ rootDir: APP_ROOT_DIR });
            const lines = Math.max(1, parseInt(options.lines, 10) || 80);
            const targetFilePath = options.errors ? errorLogFilePath : logFilePath;

            header(options.errors ? '📕  Picobot error logs' : '📘  Picobot runtime logs');
            info(`Log file: ${targetFilePath}`);

            if (!existsSync(targetFilePath)) {
                warning('No log file exists yet for that target. Start Picobot first to generate logs.');
                return;
            }

            const content = readLogTail({ filePath: targetFilePath, lines });
            if (!content.trim()) {
                warning('The log file exists but is currently empty.');
                return;
            }

            basicLog(`${content}\n`);
        });
};