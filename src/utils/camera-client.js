import { ReolinkClient } from 'reolink-nvr-api';
import { getConfigValue } from '../config/config.js';
import { logger } from './logger.js';

// Reolink camera client
let reolinkClient = null;

// Close the shared session on process exit to free the NVR slot
const closeSharedSession = async () => {
    // Exit early if the client was never initialized
    if (!reolinkClient) {
        return;
    }

    try {
        await reolinkClient.close(); // Close the session to free up the NVR slot
        logger.debug('Reolink camera client session closed');
    } catch {
        // Ignore errors during cleanup
    }

    // Reset the client variable
    reolinkClient = null;
};

// Register signal handlers once to ensure cleanup on unexpected exits
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(signal, async () => {
        await closeSharedSession();
        process.exit(0);
    });
}

// Init the camera client
const initCameraClient = async () => {
    // Read NVR credentials from config
    const host = getConfigValue('nvr.host');
    const username = getConfigValue('nvr.username');
    const password = getConfigValue('nvr.password');

    // Validate credentials are present
    if (!host || !username || !password) {
        throw new Error('NVR not configured. Please add nvr.host, nvr.username, and nvr.password to your config.');
    }

    // Create the client (long mode = token-based auth, auto-refreshed)
    reolinkClient = new ReolinkClient({
        host,
        username,
        password
    });

    try {
        await reolinkClient.login(); // Authenticate immediately to verify credentials and catch errors early
    } catch (error) {
        reolinkClient = null; // Reset so the next call retries

        // Handle the specific cases
        if (error?.rspCode === -5) {
            throw new Error('NVR rejected login: maximum sessions reached (-5). Wait a few minutes for stale sessions to expire, or reboot the NVR.');
        }

        // Rethrow other errors
        throw error;
    }

    // Log successful authentication
    logger.debug('Reolink camera client authenticated');
    return reolinkClient;
};

// Return the shared session, creating it on first call
export const getCameraClient = async () => {
    // Check if the client is already initialized
    if (reolinkClient) {
        return reolinkClient;
    }

    // Create the client if it doesn't exist
    const client = await initCameraClient();
    return client;
};