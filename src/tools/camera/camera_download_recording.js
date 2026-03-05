import { createWriteStream, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { join } from 'path';
import { fetch as undiciFetch, Agent as UndiciAgent } from 'undici';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { WORKSPACE_DIR } from '../../config.js';
import { getCameraClient } from '../../utils/camera-client.js';

// Parse "YYYY-MM-DD HH:MM:SS" → NVR time object { year, mon, day, hour, min, sec }
const parseReoTime = str => {
    const d = new Date(str.replace(' ', 'T'));
    if (isNaN(d.getTime())) throw new Error(`Invalid datetime string: "${str}"`);
    return { year: d.getFullYear(), mon: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), min: d.getMinutes(), sec: d.getSeconds() };
};

// Camera recording download tool
export const cameraDownloadRecordingTool = {
    // Tool definition
    name: 'camera_download_recording',
    description: 'Download a specific NVR recording to a local file. Use the start and end values from camera_search_recordings to identify the clip. Returns the saved file path.',
    parameters: {
        type: 'object',
        properties: {
            channel: {
                type: 'number',
                description: 'Camera channel (0-based). Default 0.'
            },
            startTime: {
                type: 'string',
                description: 'Recording start — use the "start" value returned by camera_search_recordings (e.g. "2026-03-05 06:45:48").'
            },
            endTime: {
                type: 'string',
                description: 'Recording end — use the "end" value returned by camera_search_recordings (e.g. "2026-03-05 06:47:54").'
            },
            streamType: {
                type: 'string',
                description: '"main" or "sub". Default "main".'
            }
        },
        required: ['startTime', 'endTime']
    },

    // Main execution function
    execute: async args => {
        const { channel = 0, startTime, endTime, streamType = 'main' } = args;

        let reoStart, reoEnd;
        try {
            reoStart = parseReoTime(startTime);
            reoEnd = parseReoTime(endTime);
        } catch (e) {
            return handleToolError({ message: e.message });
        }

        const pad = n => String(n).padStart(2, '0');
        const ts = t => `${t.year}${pad(t.mon)}${pad(t.day)}_${pad(t.hour)}${pad(t.min)}${pad(t.sec)}`;
        logger.debug(`Camera: downloading recording ch${channel} ${ts(reoStart)} → ${ts(reoEnd)}`);

        try {
            const client = await getCameraClient();

            // Step 1: Ask the NVR to prepare the clip and return its internal filename
            const nvrResult = await client.api('NvrDownload', {
                NvrDownload: {
                    channel,
                    iLogicChannel: 0,
                    streamType,
                    StartTime: reoStart,
                    EndTime: reoEnd
                }
            }, 1);

            const fileList = nvrResult?.fileList ?? [];
            if (fileList.length === 0) {
                return handleToolError({ message: 'NVR returned no files for the specified recording window.' });
            }

            // When multiple segments are returned, pick the largest
            const nvrFile = fileList.reduce((best, f) =>
                parseInt(f.fileSize, 10) > parseInt(best.fileSize, 10) ? f : best
            );
            const nvrFileName = nvrFile.fileName;

            // Build a clean local output path using the recording timestamps
            const outputName = `ch${channel}_${ts(reoStart)}.mp4`;
            const cameraDir = join(WORKSPACE_DIR, 'camera');
            mkdirSync(cameraDir, { recursive: true });
            const outputPath = join(cameraDir, outputName);

            // Step 2: Stream the file from the NVR (POST with empty body, source= as query param)
            const user = encodeURIComponent(client.username);
            const pass = encodeURIComponent(client.password);
            const downloadUrl = `https://${client.host}/cgi-bin/api.cgi?cmd=Download&source=${encodeURIComponent(nvrFileName)}&output=${encodeURIComponent(outputName)}&user=${user}&password=${pass}`;

            const dispatcher = new UndiciAgent({ connect: { rejectUnauthorized: false } });
            const response = await undiciFetch(downloadUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([{}]),
                dispatcher
            });

            if (!response.ok) {
                return handleToolError({ message: `NVR returned HTTP ${response.status} while downloading the recording.` });
            }

            await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));

            logger.debug(`Camera: recording saved to ${outputPath}`);
            return handleToolResponse({ outputPath, nvrFileName, channel });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to download recording' });
        }
    }
};