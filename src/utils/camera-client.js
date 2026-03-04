import { ReolinkClient } from 'reolink-nvr-api';
import { getConfigValue } from '../config/config.js';
import { logger } from './logger.js';

// Singleton session — reused across all camera tool calls
let sharedClient = null;

// Close the shared session — called on process exit signals
const closeSharedSession = async () => {
    if (!sharedClient) return;
    logger.debug('Camera: closing shared session before exit');
    try {
        await sharedClient.close();
    } catch { /* ignore errors during cleanup */ }
    sharedClient = null;
};

// Register signal handlers once to ensure cleanup on unexpected exits
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(signal, async () => {
        await closeSharedSession();
        process.exit(0);
    });
}

// Create and authenticate a new Reolink client from config
const createNewClient = async () => {
    // Read NVR credentials from config
    const host = getConfigValue('nvr.host');
    const username = getConfigValue('nvr.username');
    const password = getConfigValue('nvr.password');

    // Validate credentials are present
    if (!host || !username || !password) {
        throw new Error('NVR not configured. Please add nvr.host, nvr.username, and nvr.password to your config.');
    }

    // Create the client
    const client = new ReolinkClient({
        host,
        username,
        password,
        mode: 'short',
        https: true
    });

    try {
        await client.login(); // Authenticate the client
    } catch (error) {
        // Catch specific error for maximum sessions reached
        if (error?.rspCode === -5) {
            throw new Error('NVR rejected login: maximum sessions reached (-5). Previous sessions may still be open. Wait a few minutes for them to expire, or reboot the NVR.');
        }

        // For other errors, rethrow with a generic message
        throw error;
    }

    // Log successful authentication
    logger.debug('Reolink camera client authenticated');
    return client;
};

// Return the shared session, creating or reconnecting if needed
export const getCameraClient = async () => {
    if (!sharedClient) {
        sharedClient = await createNewClient();
    }
    return sharedClient;
};

// Call this if the session appears expired — forces a fresh login on next getCameraClient()
export const resetCameraSession = async () => {
    if (!sharedClient) return;
    try {
        await sharedClient.close();
    } catch { /* ignore */ }
    sharedClient = null;
    logger.debug('Camera: session reset, will reconnect on next request');
};