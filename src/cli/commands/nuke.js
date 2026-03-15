import { rmSync } from 'fs';
import { resolveLogFiles } from '../../../squadforge/src/index.js';
import { APP_ROOT_DIR, CONFIG_DIR, CRONS_DIR, SESSIONS_DIR } from '../../config.js';
import { header, success, error, newline } from '../../utils/common/print.js';

// Register the nuke command
export const registerNukeCommand = ({ program }) => {
    program
        .command('nuke')
        .description('Delete all configuration files to nuke Picobot')
        .action(async () => {
            // Print nuke header
            header('🔥  Picobot nuke - deleting all config files');

            try {
                // Resolve log directory path
                const { logsDir } = resolveLogFiles({ rootDir: APP_ROOT_DIR });

                // Delete config directory in the user home (config.json + workspace)
                rmSync(CONFIG_DIR, { recursive: true, force: true });
                success(`Deleted home config directory and all contents (${CONFIG_DIR})`);

                // Delete project-local runtime storage
                [SESSIONS_DIR, CRONS_DIR, logsDir].forEach(directoryPath => {
                    rmSync(directoryPath, { recursive: true, force: true });
                    success(`Deleted project runtime directory (${directoryPath})`);
                });

                // Final success message
                newline();
                success('All configuration files have been deleted.');
                success('Run `picobot onboard` to set up Picobot again.');
                newline();
            } catch (err) {
                error(`Failed to nuke Picobot: ${err.message}`);
                process.exit(1);
            }
        });
};