import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ConfigSchema } from './schema.js';
import { error, suggestion, listItem, newline } from '../utils/print.js';
import { expandPath } from '../utils/utils.js';
import { CONFIG_PATH } from '../config.js';

// In-memory configuration store
let configStore = null;

// Set the configuration
export const setConfig = newConfig => {
    configStore = newConfig;
};

// Get the entire configuration
export const getConfig = () => {
    // Ensure config is initialized
    if (!configStore) {
        throw new Error('Config not initialized. Call setConfig() first.');
    }

    // Return the config object
    return configStore;
};

// Get a specific config value by path (e.g., 'telegram.token')
export const getConfigValue = path => {
    const config = getConfig();
    return path.split('.').reduce((object, key) => object?.[key], config);
};

// Load configuration from JSON file
export const loadConfig = ({ filePath = CONFIG_PATH } = {}) => {
    // Check if config file exists
    if (!existsSync(filePath)) {
        error(`Config file not found: ${filePath}`);
        suggestion(`Run 'picobot onboard' to create the configuration file`);
        return false;
    }

    try {
        // Read and parse config file
        const content = readFileSync(filePath, 'utf-8');
        const config = JSON.parse(content);

        // Expand workspace path
        config.workspace = expandPath(config.workspace);

        // Return raw config on success
        return config;
    } catch (error) {
        error(`Failed to load config: ${error.message}`);
        suggestion(`Run 'picobot onboard' to create the configuration file`);
        return false;
    }
};

// Write configuration to the default config file
export const writeConfig = config => {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

// Validate configuration (both structure and required values)
export const validateConfig = ({ config }) => {
    // Structural and value validation using Zod
    const validation = ConfigSchema.safeParse(config);
    if (!validation.success) {
        // Print validation error
        error('Configuration validation failed:');

        // Print each validation issue
        validation.error.issues.forEach(issue => {
            listItem(`${issue.path.join('.')}: ${issue.message}`, 'red', 3);
        });

        // Suggest onboard command
        newline();
        suggestion(`Run 'picobot onboard' to complete the configuration`);
        return false;
    }

    // Return validated config on success
    return validation.data;
};