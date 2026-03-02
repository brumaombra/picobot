import { join } from 'path';
import { writeFileSync } from 'fs';
import { ReolinkClient } from 'reolink-nvr-api';
import { getConfigValue } from '../../config/config.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { WORKSPACE_DIR } from '../../config.js';

// Create and authenticate a Reolink client from config
const createClient = async () => {
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
    return client;
};

// Execute a camera operation and automatically close the client afterward
const withClient = async fn => {
    const client = await createClient();
    try {
        return await fn(client);
    } finally {
        await client.close();
    }
};

// Camera device info tool
export const cameraGetInfoTool = {
    // Tool definition
    name: 'camera_get_info',
    description: 'Get NVR device information and the list of connected camera channels.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        // Log the action
        logger.debug('Camera: fetching device info');

        try {
            return await withClient(async client => {
                // Fetch device info and channel status
                const devInfo = await client.api('GetDevInfo', {});
                const channelInfo = await client.api('GetChannelstatus', {}).catch(() => null);

                // Return device and channel information
                return handleToolResponse({ device: devInfo, channels: channelInfo });
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get NVR device info' });
        }
    }
};

// Camera snapshot tool
export const cameraSnapshotTool = {
    // Tool definition
    name: 'camera_snapshot',
    description: 'Capture a snapshot (JPEG image) from a camera channel. Saves it to the workspace and returns the file path so it can be sent to the user with the send_file tool.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const channel = args.channel ?? 0;

        // Log the action
        logger.debug(`Camera: taking snapshot on channel ${channel}`);

        try {
            return await withClient(async client => {
                // Capture the snapshot as a buffer
                const buffer = await client.snapshotToBuffer(channel);

                // Save the snapshot to the workspace
                const filename = `snapshot_ch${channel}_${Date.now()}.jpg`;
                const filePath = join(WORKSPACE_DIR, filename);
                writeFileSync(filePath, buffer);
                logger.debug(`Camera: snapshot saved to ${filePath}`);

                // Return the file path for the agent to send
                return handleToolResponse({ filePath, filename, channel });
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to capture snapshot' });
        }
    }
};

// Camera stream URL tool
export const cameraGetStreamUrlTool = {
    // Tool definition
    name: 'camera_get_stream_url',
    description: 'Get the live stream URL for a camera channel. Returns RTSP and FLV URLs that can be opened in a media player.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            },
            streamType: {
                type: 'string',
                enum: ['main', 'sub'],
                description: 'Stream quality. "main" is full resolution; "sub" is lower resolution. Default is "main".'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const { channel = 0, streamType = 'main' } = args;

        // Log the action
        logger.debug(`Camera: getting stream URLs for channel ${channel}`);

        try {
            // Read NVR credentials from config
            const host = getConfigValue('nvr.host');
            const username = getConfigValue('nvr.username');
            const password = getConfigValue('nvr.password');

            // Validate credentials are present
            if (!host || !username || !password) {
                return handleToolError({ message: 'NVR not configured. Please add nvr.host, nvr.username, and nvr.password to your config.' });
            }

            // Build RTSP URL with embedded credentials
            const rtspUrl = `rtsp://${username}:${password}@${host}:554/h264Preview_${String(channel + 1).padStart(2, '0')}_${streamType}`;

            // Build FLV URL
            const flvUrl = `http://${host}/flv?port=1935&app=bcs&stream=channel${channel}_${streamType}.bcs&user=${username}&password=${password}`;

            // Return the stream URLs
            return handleToolResponse({ rtspUrl, flvUrl, channel, streamType });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get stream URLs' });
        }
    }
};

// Camera AI detection state tool
export const cameraAiStateTool = {
    // Tool definition
    name: 'camera_ai_state',
    description: 'Get the current AI detection state for a camera channel. Shows whether persons, vehicles, or pets have been detected.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const channel = args.channel ?? 0;

        // Log the action
        logger.debug(`Camera: getting AI state for channel ${channel}`);

        try {
            return await withClient(async client => {
                // Fetch the AI detection state
                const state = await client.api('GetAiState', { channel, action: 0 });

                // Return the AI detection state
                return handleToolResponse({ channel, aiState: state });
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get AI detection state' });
        }
    }
};

// Camera motion detection state tool
export const cameraMotionStateTool = {
    // Tool definition
    name: 'camera_motion_state',
    description: 'Check the current motion detection state for a camera channel.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            }
        },
        required: []
    },

    // Main execution function
    execute: async args => {
        const channel = args.channel ?? 0;

        // Log the action
        logger.debug(`Camera: getting motion state for channel ${channel}`);

        try {
            return await withClient(async client => {
                // Fetch the motion detection state
                const state = await client.api('GetMdState', { channel, action: 0 });

                // Return the motion detection state
                return handleToolResponse({ channel, motionState: state });
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get motion detection state' });
        }
    }
};

// Camera recording search tool
export const cameraSearchRecordingsTool = {
    // Tool definition
    name: 'camera_search_recordings',
    description: 'Search for recorded footage on the NVR within a date/time range for a specific channel.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            },
            startTime: {
                type: 'string',
                description: 'Start of search window as an ISO 8601 datetime string (e.g. "2025-01-15T08:00:00Z").'
            },
            endTime: {
                type: 'string',
                description: 'End of search window as an ISO 8601 datetime string (e.g. "2025-01-15T20:00:00Z").'
            },
            streamType: {
                type: 'string',
                enum: ['main', 'sub'],
                description: 'Stream type to search. Default is "main".'
            }
        },
        required: ['startTime', 'endTime']
    },

    // Main execution function
    execute: async args => {
        const { channel = 0, startTime, endTime, streamType = 'main' } = args;

        // Log the action
        logger.debug(`Camera: searching recordings on channel ${channel} from ${startTime} to ${endTime}`);

        try {
            return await withClient(async client => {
                // Parse the time range
                const start = new Date(startTime);
                const end = new Date(endTime);

                // Build the search payload
                const payload = {
                    channel,
                    streamType,
                    StartTime: {
                        year: start.getUTCFullYear(),
                        mon: start.getUTCMonth() + 1,
                        day: start.getUTCDate(),
                        hour: start.getUTCHours(),
                        min: start.getUTCMinutes(),
                        sec: start.getUTCSeconds()
                    },
                    EndTime: {
                        year: end.getUTCFullYear(),
                        mon: end.getUTCMonth() + 1,
                        day: end.getUTCDate(),
                        hour: end.getUTCHours(),
                        min: end.getUTCMinutes(),
                        sec: end.getUTCSeconds()
                    }
                };

                // Execute the search
                const results = await client.api('Search', payload);

                // Return the recordings list
                return handleToolResponse({ channel, startTime, endTime, recordings: results });
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to search recordings' });
        }
    }
};