import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { getConfigValue } from '../../config/config.js';

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