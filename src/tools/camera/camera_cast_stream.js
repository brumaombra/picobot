import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';
import { castUrlToChromecast } from '../../utils/google/chromecast.js';
import { getCameraLiveRelay, startCameraLiveRelay, stopCameraLiveRelay } from '../../utils/camera/camera-live-stream.js';

// Camera Chromecast casting tool
export const cameraCastStreamTool = {
    // Tool definition
    name: 'camera_cast_stream',
    description: 'Cast a camera stream to Chromecast with action-based control: start or stop.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['start', 'stop'],
                description: 'Use "start" to start/reuse relay and cast to Chromecast, or "stop" to stop relay(s).'
            },
            chromecastHost: {
                type: 'string',
                description: 'Chromecast IP/host on the local network (e.g. 192.168.1.55). Required for action="start".'
            },
            channel: {
                type: 'number',
                description: 'Camera channel (0-based). Default is 0. For action="stop", omit channel to stop all relays.'
            },
            streamType: {
                type: 'string',
                enum: ['main', 'sub'],
                description: 'NVR stream profile used when action="start" (default: sub).'
            },
            port: {
                type: 'number',
                description: 'Optional HTTP port for HLS relay server when action="start" (default: 48761).'
            }
        },
        required: ['action']
    },

    // Main execution function
    execute: async args => {
        const action = String(args?.action || '').trim().toLowerCase();
        const hasChannel = Number.isFinite(args?.channel);
        const channel = hasChannel ? args.channel : 0;
        const streamType = args?.streamType || 'sub';
        const port = Number.isFinite(args?.port) ? args.port : 48761;
        const chromecastHost = String(args?.chromecastHost || '').trim();

        // Validate action mode
        if (action !== 'start' && action !== 'stop') {
            return handleToolError({ message: 'Invalid action for camera_cast_stream. Use "start" or "stop".' });
        }

        // Stop mode: stop one channel or all channels and return immediately
        if (action === 'stop') {
            try {
                const result = stopCameraLiveRelay({ channel: hasChannel ? channel : undefined });
                return handleToolResponse({ action: 'stop', ...result });
            } catch (error) {
                return handleToolError({ error, message: 'Failed to stop live camera stream relay' });
            }
        }

        // Start mode requires a Chromecast host for immediate casting
        if (!chromecastHost) {
            return handleToolError({ message: 'chromecastHost is required for action="start".' });
        }

        try {
            // Start/reuse relay, then cast to Chromecast
            let relay = getCameraLiveRelay({ channel });
            if (!relay) {
                relay = await startCameraLiveRelay({ channel, streamType, port });
            }

            const streamUrl = relay?.hlsUrl || getCameraLiveRelay({ channel })?.hlsUrl;
            if (!streamUrl) {
                return handleToolError({ message: `No stream URL available for channel ${channel}.` });
            }

            const result = await castUrlToChromecast({ host: chromecastHost, mediaUrl: streamUrl });
            return handleToolResponse({
                action: 'start',
                chromecastHost,
                channel,
                streamUrl,
                relayAlreadyRunning: Boolean(relay?.alreadyRunning),
                castStatus: result.status || 'started'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to cast stream to Chromecast' });
        }
    }
};