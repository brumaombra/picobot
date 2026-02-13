import { Command } from 'commander';
import { registerStartCommand } from './commands/start.js';
import { registerOnboardCommand } from './commands/onboard.js';
import { registerStatusCommand } from './commands/status.js';
import { registerNukeCommand } from './commands/nuke.js';
import { registerPromptsCommand } from './commands/prompts.js';
import { APP_NAME, APP_DESCRIPTION, APP_VERSION } from '../config.js';

// Create CLI program
const program = new Command();

// Set CLI metadata
program
    .name(APP_NAME)
    .description(APP_DESCRIPTION)
    .version(APP_VERSION);

// Register commands
registerStartCommand({ program });
registerOnboardCommand({ program });
registerStatusCommand({ program });
registerNukeCommand({ program });
registerPromptsCommand({ program });

// Parse and execute
program.parse();