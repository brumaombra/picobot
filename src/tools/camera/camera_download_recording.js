import { join } from 'path';
import { createWriteStream, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import https from 'https';
import { fetch as undiciFetch, Agent as UndiciAgent } from 'undici';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { WORKSPACE_DIR } from '../../config.js';
import { getCameraClient } from '../../utils/camera-client.js';

// Camera recording download tool
export const cameraDownloadRecordingTool = {
    // Tool definition
    name: 'camera_download_recording',
    description: 'Download a recorded video file from the NVR. Saves it to the camera folder in the workspace and returns the local file path.',
    parameters: {
        type: 'object',
        properties: {
            fileName: {
                type: 'string',
                description: 'The file name of the recording to download.'
            },
            channel: {
                type: 'number',
                description: 'Camera channel number (0-based). Default is 0.'
            }
        },
        required: ['fileName']
    },

    // Main execution function
    execute: async args => {
        const { fileName, channel = 0 } = args;

        // Build the output path in the camera folder of the workspace
        const cameraDir = join(WORKSPACE_DIR, 'camera');
        mkdirSync(cameraDir, { recursive: true });
        const outputPath = join(cameraDir, fileName.split(/[\/]/).pop());

        // Log the action
        logger.debug(`Camera: downloading recording "${fileName}" on channel ${channel} to ${outputPath}`);

        try {
            // Get the camera client
            const client = await getCameraClient();

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
                queryParams = `cmd=Download&channel=${channel}&streamType=0&fileName=${encodeURIComponent(fileName)}&user=${user}&password=${pass}`;
            } else {
                const token = client.getToken();
                queryParams = `cmd=Download&channel=${channel}&streamType=0&fileName=${encodeURIComponent(fileName)}&token=${token}`;
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
            return handleToolResponse({ outputPath, fileName, channel });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to download recording' });
        }
    }
};