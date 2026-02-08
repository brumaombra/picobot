import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_PATH, CONFIG_DIR, WORKSPACE_DIR, PROMPT_DIR, SESSIONS_DIR, LOGS_DIR, AGENTS_PATH, SOUL_PATH, USER_PATH } from '../config.js';
import { success, warning, error, newline } from '../utils/print.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if the config files and directories exist
export const checkIfConfigFilesExist = () => {
    // Check existence
    const configDirExists = existsSync(CONFIG_DIR);
    const workspaceDirExists = existsSync(WORKSPACE_DIR);
    const promptDirExists = existsSync(PROMPT_DIR);
    const sessionsDirExists = existsSync(SESSIONS_DIR);
    const logsDirExists = existsSync(LOGS_DIR);
    const agentsExists = existsSync(AGENTS_PATH);
    const soulExists = existsSync(SOUL_PATH);
    const userExists = existsSync(USER_PATH);
    const configExists = existsSync(CONFIG_PATH);

    // Check if the config directory exists
    if (configDirExists) {
        success(`Config directory exists (${CONFIG_DIR})`);
    } else {
        error(`Config directory does not exist (${CONFIG_DIR})`);
    }

    // Check if the workspace directory exists
    if (workspaceDirExists) {
        success(`Workspace directory exists (${WORKSPACE_DIR})`);
    } else {
        error(`Workspace directory does not exist (${WORKSPACE_DIR})`);
    }

    // Check if the prompt directory exists
    if (promptDirExists) {
        success(`Prompt directory exists (${PROMPT_DIR})`);
    } else {
        error(`Prompt directory does not exist (${PROMPT_DIR})`);
    }

    // Check if the sessions directory exists
    if (sessionsDirExists) {
        success(`Sessions directory exists (${SESSIONS_DIR})`);
    } else {
        error(`Sessions directory does not exist (${SESSIONS_DIR})`);
    }

    // Check if the logs directory exists
    if (logsDirExists) {
        success(`Logs directory exists (${LOGS_DIR})`);
    } else {
        error(`Logs directory does not exist (${LOGS_DIR})`);
    }

    // Check if AGENTS.md exists
    if (agentsExists) {
        success(`AGENTS.md exists (${AGENTS_PATH})`);
    } else {
        error(`AGENTS.md does not exist (${AGENTS_PATH})`);
    }

    // Check if SOUL.md exists
    if (soulExists) {
        success(`SOUL.md exists (${SOUL_PATH})`);
    } else {
        error(`SOUL.md does not exist (${SOUL_PATH})`);
    }

    // Check if USER.md exists
    if (userExists) {
        success(`USER.md exists (${USER_PATH})`);
    } else {
        error(`USER.md does not exist (${USER_PATH})`);
    }

    // Check if config file exists
    if (configExists) {
        success(`Config file exists (${CONFIG_PATH})`);
    } else {
        error(`Config file does not exist (${CONFIG_PATH})`);
    }

    // If any are missing, tell the user to run onboard
    const allExist = configDirExists && workspaceDirExists && promptDirExists && sessionsDirExists && logsDirExists && agentsExists && soulExists && userExists && configExists;
    if (!allExist) {
        newline();
        warning('One or more configuration files or directories are missing. Please run `picobot onboard` to set up Picobot.');
    };

    // Add a blank line for readability
    newline();

    // Return the result
    return allExist;
};

// Create necessary configuration files and directories
export const createConfigFiles = () => {
    // Create config directory
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
        success(`Created config directory (${CONFIG_DIR})`);
    } else {
        success(`Config directory already exists (${CONFIG_DIR})`);
    }

    // Create workspace directory
    if (!existsSync(WORKSPACE_DIR)) {
        mkdirSync(WORKSPACE_DIR, { recursive: true });
        success(`Created workspace directory (${WORKSPACE_DIR})`);
    } else {
        success(`Workspace directory already exists (${WORKSPACE_DIR})`);
    }

    // Create prompt directory
    if (!existsSync(PROMPT_DIR)) {
        mkdirSync(PROMPT_DIR, { recursive: true });
        success(`Created prompt directory (${PROMPT_DIR})`);
    } else {
        success(`Prompt directory already exists (${PROMPT_DIR})`);
    }

    // Create sessions directory
    if (!existsSync(SESSIONS_DIR)) {
        mkdirSync(SESSIONS_DIR, { recursive: true });
        success(`Created sessions directory (${SESSIONS_DIR})`);
    } else {
        success(`Sessions directory already exists (${SESSIONS_DIR})`);
    }

    // Create logs directory
    if (!existsSync(LOGS_DIR)) {
        mkdirSync(LOGS_DIR, { recursive: true });
        success(`Created logs directory (${LOGS_DIR})`);
    } else {
        success(`Logs directory already exists (${LOGS_DIR})`);
    }

    // Create AGENTS.md if it doesn't exist
    if (!existsSync(AGENTS_PATH)) {
        const agentsContent = readFileSync(join(__dirname, 'examples/AGENTS.md'), 'utf-8');
        writeFileSync(AGENTS_PATH, agentsContent);
        success(`Created AGENTS.md (${AGENTS_PATH})`);
    } else {
        success(`AGENTS.md already exists (${AGENTS_PATH})`);
    }

    // Create SOUL.md if it doesn't exist
    if (!existsSync(SOUL_PATH)) {
        const soulContent = readFileSync(join(__dirname, 'examples/SOUL.md'), 'utf-8');
        writeFileSync(SOUL_PATH, soulContent);
        success(`Created SOUL.md (${SOUL_PATH})`);
    } else {
        success(`SOUL.md already exists (${SOUL_PATH})`);
    }

    // Create USER.md if it doesn't exist
    if (!existsSync(USER_PATH)) {
        const userContent = readFileSync(join(__dirname, 'examples/USER.md'), 'utf-8');
        writeFileSync(USER_PATH, userContent);
        success(`Created USER.md (${USER_PATH})`);
    } else {
        success(`USER.md already exists (${USER_PATH})`);
    }

    // Create config file if it doesn't exist
    if (!existsSync(CONFIG_PATH)) {
        const configContent = readFileSync(join(__dirname, 'examples/config.json'), 'utf-8');
        const config = JSON.parse(configContent);
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        success(`Created config file (${CONFIG_PATH})`);
    } else {
        success(`Config file already exists (${CONFIG_PATH})`);
    }
};