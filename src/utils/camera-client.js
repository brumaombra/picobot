import { ReolinkClient } from 'reolink-nvr-api';
import { getConfigValue } from '../config/config.js';
import { logger } from './logger.js';
import { timestampStringToReolinkDate, reolinkDateToTimestampString, formatTime } from './utils.js';
import { createWriteStream, writeFileSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { fetch as undiciFetch, Agent as UndiciAgent } from 'undici';

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

// Search recordings on the NVR with Reolink Search payload format
export const searchNvrRecordings = async ({ channel = 0, startTime, endTime, streamType = 'main', onlyStatus = 0 }) => {
    const client = await getCameraClient();
    const startReolinkTime = timestampStringToReolinkDate(startTime);
    const endReolinkTime = timestampStringToReolinkDate(endTime);

    // Search the NVR for recordings
    const results = await client.api('Search', {
        Search: {
            channel,
            onlyStatus,
            streamType,
            StartTime: startReolinkTime,
            EndTime: endReolinkTime
        }
    });

    // Parse the results into a more user-friendly format
    const files = results?.SearchResult?.File ?? [];
    const recordings = files.map(file => {
        // Create the parameters
        const startTimeVideo = file.StartTime;
        const endTimeVideo = file.EndTime;
        const startDateVideo = new Date(startTimeVideo.year, startTimeVideo.mon - 1, startTimeVideo.day, startTimeVideo.hour, startTimeVideo.min, startTimeVideo.sec);
        const endDateVideo = new Date(endTimeVideo.year, endTimeVideo.mon - 1, endTimeVideo.day, endTimeVideo.hour, endTimeVideo.min, endTimeVideo.sec);
        const durationSec = (endDateVideo - startDateVideo) / 1000;
        const sizeMB = (parseInt(file.size, 10) / 1024 / 1024).toFixed(1);

        // Return the recording info in a more readable format
        return {
            start: reolinkDateToTimestampString(startTimeVideo),
            end: reolinkDateToTimestampString(endTimeVideo),
            duration: formatTime(durationSec * 1000),
            size: `${sizeMB} MB`,
            type: file.type
        };
    });

    // Return the parsed recordings and the raw results for debugging
    return {
        recordings,
        count: recordings.length
    };
};

// Download an NVR recording to disk by time window (prepare + binary download)
export const downloadNvrRecordingToPath = async ({ channel = 0, startTime, endTime, streamType = 'main', iLogicChannel = 0, outputName, outputPath }) => {
    const client = await getCameraClient();
    const startReolinkTime = timestampStringToReolinkDate(startTime);
    const endReolinkTime = timestampStringToReolinkDate(endTime);

    // Prepare the recording for download and get the actual file name on the NVR
    const nvrResult = await client.api('NvrDownload', {
        NvrDownload: {
            channel,
            iLogicChannel,
            streamType,
            StartTime: startReolinkTime,
            EndTime: endReolinkTime
        }
    }, 1);

    // Check if the NVR returned any files
    const fileList = nvrResult?.fileList ?? [];
    if (fileList.length === 0) {
        throw new Error('NVR returned no files for the specified recording window.');
    }

    // If multiple files are returned, select the one with the largest file size (heuristic for best match)
    const bestFile = fileList.reduce((best, current) => {
        return parseInt(current.fileSize, 10) > parseInt(best.fileSize, 10) ? current : best;
    });

    // Prepare the parameters for the download URL
    const nvrFileName = bestFile.fileName;
    const user = encodeURIComponent(client.username);
    const pass = encodeURIComponent(client.password);

    // Keep '/' in source path and encode only spaces to match Reolink URL expectations
    const sourceParam = String(nvrFileName).replace(/ /g, '%20');
    const outputParam = encodeURIComponent(outputName);
    const downloadUrl = `https://${client.host}/cgi-bin/api.cgi?cmd=Download&source=${sourceParam}&output=${outputParam}&user=${user}&password=${pass}`;

    // Download the file using undici
    const dispatcher = new UndiciAgent({ connect: { rejectUnauthorized: false } });
    const response = await undiciFetch(downloadUrl, { method: 'GET', dispatcher });

    // Check if the download request was successful
    if (!response.ok) {
        throw new Error(`NVR returned HTTP ${response.status} while downloading the recording.`);
    }

    // Stream the response body to the output file
    await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));

    // Return the path to the saved file and some debug info
    return {
        outputPath,
        downloadUrl,
        nvrFileName,
        nvrResult,
        fileList,
        bestFile
    };
};

// Fetch NVR device info and channel status in a single helper
export const getNvrDeviceInfo = async () => {
    // Get the device and channel info
    const client = await getCameraClient();
    const device = await client.api('GetDevInfo', {});
    const channels = await client.api('GetChannelstatus', {}).catch(() => null);

    // Return the combined info
    return {
        device,
        channels
    };
};

// Capture a camera snapshot and save it directly to disk
export const captureSnapshotToPath = async ({ channel = 0, outputPath }) => {
    // Get the snapshot as a buffer from the client
    const client = await getCameraClient();
    const buffer = await client.snapshotToBuffer(channel);
    writeFileSync(outputPath, buffer);

    // Return the path to the saved snapshot and its size for debugging
    return {
        outputPath,
        size: buffer.length
    };
};