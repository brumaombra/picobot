import { rmSync } from 'fs';
import { CONFIG_DIR } from '../../config.js';
import { header, success, error, newline } from '../../utils/print.js';

// Register the nuke command
export const registerNukeCommand = ({ program }) => {
    program
        .command('nuke')
        .description('Delete all configuration files to nuke Picobot')
        .action(async () => {
            // Print nuke header
            header('🔥  Picobot nuke - deleting all config files');

            try {
                // Delete entire config directory (includes all subdirectories and files)
                rmSync(CONFIG_DIR, { recursive: true, force: true });
                success(`Deleted config directory and all contents (${CONFIG_DIR})`);

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