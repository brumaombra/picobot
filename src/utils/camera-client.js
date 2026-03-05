import { ReolinkClient } from 'reolink-nvr-api';
import { getConfigValue } from '../config/config.js';
import { logger } from './logger.js';

// Reolink camera client
let reolinkClient = null;

// Return the shared client, creating it on first call
export const getCameraClient = async () => {
    // If we already have a client instance, return it
    if (reolinkClient) {
        return reolinkClient;
    }

    // Read NVR credentials from config
    const host = getConfigValue('nvr.host');
    const username = getConfigValue('nvr.username');
    const password = getConfigValue('nvr.password');

    // Validate that all required credentials are present
    if (!host || !username || !password) {
        throw new Error('NVR not configured. Please add nvr.host, nvr.username, and nvr.password to your config.');
    }

    // Short mode: credentials go in the query string on every request.
    reolinkClient = new ReolinkClient({ host, username, password, mode: 'short' });
    logger.debug('Reolink camera client created (short mode)');

    // Return the shared client instance
    return reolinkClient;
};

// Drop the cached client (forces a new instance on the next call)
export const resetCameraSession = async () => {
    reolinkClient = null;
    logger.debug('Reolink camera client reset');
};