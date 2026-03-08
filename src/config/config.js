import { existsSync, readFileSync, writeFileSync } from 'fs';
import { configSchema } from './schema.js';
import { error, suggestion, listItem, newline } from '../utils/common/print.js';
import { expandPath } from '../utils/common/utils.js';
import { CONFIG_PATH, SECRET_ENV_OVERRIDES } from '../config.js';

// In-memory configuration store
let configStore = null;

// Set nested config value by dot path, creating intermediate objects when needed
const setByPath = ({ target, path, value }) => {
    const keys = path.split('.');
    let cursor = target;

    // Traverse the path, creating intermediate objects if they don't exist
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }

    // Set the final value at the end of the path
    cursor[keys[keys.length - 1]] = value;
};

// Apply environment variable overrides for secret config values
const applySecretEnvOverrides = ({ config }) => {
    // Loop through the defined secrets
    for (const [path, envVar] of Object.entries(SECRET_ENV_OVERRIDES)) {
        const envValue = process.env[envVar];
        if (typeof envValue === 'string' && envValue.trim()) {
            // Parse allowed users as a comma-separated list
            if (path === 'telegram.allowedUsers') {
                const allowedUsers = envValue
                    .split(',')
                    .map(user => user.trim())
                    .filter(Boolean);
                setByPath({ target: config, path, value: allowedUsers });
            } else {
                setByPath({ target: config, path, value: envValue.trim() });
            }
        }
    }

    // Return the config with overrides applied
    return config;
};

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
        let config = JSON.parse(content);

        // Override secret values from environment variables when provided
        config = applySecretEnvOverrides({ config });

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
    const validation = configSchema.safeParse(config);
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