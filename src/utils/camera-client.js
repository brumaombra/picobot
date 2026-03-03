import { ReolinkClient } from 'reolink-nvr-api';
import { getConfigValue } from '../config/config.js';
import { logger } from './logger.js';

// Create and authenticate a Reolink client from config
export const createCameraClient = async () => {
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

    // Authenticate the client
    await client.login();
    logger.debug('Reolink camera client authenticated');
    return client;
};