import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import https from 'https';
import { fetch as undiciFetch, Agent as UndiciAgent } from 'undici';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { createCameraClient } from '../../utils/camera-client.js';

// Camera recording download tool
export const cameraDownloadRecordingTool = {
    // Tool definition
    name: 'camera_download_recording',
    description: 'Download a recorded video file from the NVR to a local path. Use camera_search_recordings first to get the file name.',
    parameters: {
        type: 'object',
        properties: {
            fileName: {
                type: 'string',
                description: 'The file name of the recording to download, as returned by camera_search_recordings.'
            },
            outputPath: {
                type: 'string',
                description: 'Absolute local file path where the recording should be saved (e.g. "/tmp/recording.mp4").'
            },
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            },
            streamType: {
                type: 'string',
                enum: ['main', 'sub'],
                description: 'Stream type of the recording. Default is "main".'
            }
        },
        required: ['fileName', 'outputPath']
    },

    // Main execution function
    execute: async args => {
        const { fileName, outputPath, channel = 0, streamType = 'main' } = args;
        const streamTypeNum = streamType === 'sub' ? 1 : 0;

        // Log the action
        logger.debug(`Camera: downloading recording "${fileName}" on channel ${channel} to ${outputPath}`);

        // Create the camera client to authenticate and get connection details
        const client = await createCameraClient();

        try {
            // Extract connection details from the client
            const host = client.getHost();
            const mode = client.getMode();
            const insecure = client.isInsecure();
            const fetchImpl = client.getFetchImpl();

            // Build the download URL — same pattern as the snapshot endpoint
            const baseUrl = `https://${host}/cgi-bin/api.cgi`;
            let queryParams;

            // The NVR supports two authentication modes: short-term credentials (username/password) or token-based. Use the appropriate one based on the client's mode.
            if (mode === 'short') {
                const user = encodeURIComponent(client.getUsername());
                const pass = encodeURIComponent(client.getPassword());
                queryParams = `cmd=Download&channel=${channel}&streamType=${streamTypeNum}&fileName=${encodeURIComponent(fileName)}&user=${user}&password=${pass}`;
            } else {
                const token = client.getToken();
                queryParams = `cmd=Download&channel=${channel}&streamType=${streamTypeNum}&fileName=${encodeURIComponent(fileName)}&token=${token}`;
            }

            // Final download URL
            const target = `${baseUrl}?${queryParams}`;
            logger.debug(`Camera: download URL built for "${fileName}"`);

            // Configure fetch options — respect insecure (self-signed cert) flag
            const fetchOptions = { method: 'GET' };
            if (insecure) {
                const isUndiciFetch = fetchImpl === undiciFetch || (fetchImpl.toString().includes('undici') && fetchImpl !== globalThis.fetch);
                if (isUndiciFetch) {
                    fetchOptions.dispatcher = new UndiciAgent({ connect: { rejectUnauthorized: false } });
                } else {
                    fetchOptions.agent = new https.Agent({ rejectUnauthorized: false });
                }
            }

            // Fetch the recording
            const response = await fetchImpl(target, fetchOptions);
            if (!response.ok) {
                return handleToolError({ message: `NVR returned HTTP ${response.status} when downloading "${fileName}"` });
            }

            // Stream response body to the output file
            await pipeline(
                Readable.fromWeb(response.body),
                createWriteStream(outputPath)
            );

            // Log success
            logger.debug(`Camera: recording saved to ${outputPath}`);

            // Return the saved file path so the agent can reference or send it
            return handleToolResponse({ outputPath, fileName, channel, streamType });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to download recording' });
        } finally {
            await client.close();
        }
    }
};