import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { APP_ROOT_DIR, CONFIG_PATH, CONFIG_DIR, CRONS_DIR, LOGS_DIR, SESSIONS_DIR, USER_AGENTS_DIR, USER_PROMPTS_DIR, USER_SKILLS_DIR, WORKSPACE_DIR } from '../config.js';
import { success, warning, error, newline } from '../utils/common/print.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Filesystem items bootstrapped during onboarding
const BOOTSTRAP_ITEMS = [
    { kind: 'directory', path: CONFIG_DIR, name: 'Config directory' },
    { kind: 'file', path: CONFIG_PATH, name: 'Config file', source: join(__dirname, 'examples/config.json') },
    { kind: 'directory', path: WORKSPACE_DIR, name: 'Default workspace directory' },
    { kind: 'directory', path: SESSIONS_DIR, name: 'Sessions directory' },
    { kind: 'directory', path: LOGS_DIR, name: 'Logs directory' },
    { kind: 'directory', path: CRONS_DIR, name: 'Crons directory' },
    { kind: 'template-directory', path: USER_AGENTS_DIR, source: join(APP_ROOT_DIR, 'agents'), name: 'User agents directory' },
    { kind: 'template-directory', path: USER_PROMPTS_DIR, source: join(APP_ROOT_DIR, 'prompts'), name: 'User prompts directory' },
    { kind: 'template-directory', path: USER_SKILLS_DIR, source: join(APP_ROOT_DIR, 'skills'), name: 'User skills directory' }
];

// Minimal set of filesystem items required before Pico can run
const OPTIONAL_BOOTSTRAP_PATHS = new Set([WORKSPACE_DIR, SESSIONS_DIR, LOGS_DIR, CRONS_DIR]);
const REQUIRED_BOOTSTRAP_ITEMS = BOOTSTRAP_ITEMS.filter(item => !OPTIONAL_BOOTSTRAP_PATHS.has(item.path));

// Copy missing files from the project defaults into the user-owned directory tree without overwriting edits
const copyDirectoryDefaults = ({ sourceDir, targetDir, log = false }) => {
    // If the source doesn't exist, there's nothing to copy
    if (!existsSync(sourceDir)) {
        return;
    }

    // Ensure the target exists before walking nested entries
    mkdirSync(targetDir, { recursive: true });

    // Recursively copy only missing directories and files
    readdirSync(sourceDir, { withFileTypes: true }).forEach(entry => {
        const sourcePath = join(sourceDir, entry.name);
        const targetPath = join(targetDir, entry.name);

        // If it's a directory, ensure it exists and recurse. If it's a file, copy if missing.
        if (entry.isDirectory()) {
            // Create the directory if it doesn't exist
            const alreadyExists = existsSync(targetPath);
            if (!alreadyExists) {
                mkdirSync(targetPath, { recursive: true });
                if (log) {
                    success(`Created ${relative(CONFIG_DIR, targetPath)} (${targetPath})`);
                }
            }

            // Recurse into the directory to copy nested defaults
            copyDirectoryDefaults({ sourceDir: sourcePath, targetDir: targetPath, log });
            return;
        }

        // For files, copy if the target doesn't already exist to avoid overwriting user edits
        if (!existsSync(targetPath)) {
            copyFileSync(sourcePath, targetPath);
            if (log) {
                success(`Copied ${relative(CONFIG_DIR, targetPath)} (${targetPath})`);
            }
        }
    });
};

// Ensure a single bootstrap item exists, optionally copying missing template files
const ensureBootstrapItem = ({ item, log = false }) => {
    const exists = existsSync(item.path);

    // Handle directories, files, and template directories differently
    if (item.kind === 'directory') {
        if (!exists) mkdirSync(item.path, { recursive: true });
    } else if (item.kind === 'file') {
        if (item.source && !exists) writeFileSync(item.path, readFileSync(item.source, 'utf-8'));
    } else if (item.kind === 'template-directory') {
        mkdirSync(item.path, { recursive: true });
        if (log) success(exists ? `${item.name} already exists (${item.path})` : `Created ${item.name} (${item.path})`);
        copyDirectoryDefaults({ sourceDir: item.source, targetDir: item.path, log });
        return;
    }

    // Log the result
    if (log) {
        success(exists ? `${item.name} already exists (${item.path})` : `Created ${item.name} (${item.path})`);
    }
};

// Check if all required config files and directories exist
export const checkIfConfigFilesExist = () => {
    // Collect missing items for summary logging
    const missing = REQUIRED_BOOTSTRAP_ITEMS.filter(item => {
        const exists = existsSync(item.path);
        exists ? success(`${item.name} exists (${item.path})`) : error(`${item.name} does not exist (${item.path})`);
        return !exists;
    });

    // If any are missing, log a warning
    if (missing.length > 0) {
        newline();
        warning('One or more configuration files or directories are missing. Please run `picobot onboard` to set up Picobot.');
    }

    // Return true if all exist, false if any are missing
    newline();
    return missing.length === 0;
};

// Create missing config files, directories, and default Squadforge content for onboarding
export const bootstrapConfigFiles = () => {
    BOOTSTRAP_ITEMS.forEach(item => ensureBootstrapItem({ item, log: true }));
};