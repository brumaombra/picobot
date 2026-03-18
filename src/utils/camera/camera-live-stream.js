import { createServer } from 'http';
import { spawn } from 'child_process';
import { mkdirSync, existsSync, createReadStream } from 'fs';
import { join, normalize } from 'path';
import { networkInterfaces } from 'os';
import { getConfigValue } from '../../config/config.js';
import { rtspUrl } from 'reolink-nvr-api/stream';
import { logger } from 'squadforge';

const DEFAULT_STREAM_PORT = 48761;
const activeStreams = new Map();
let server = null;
let serverPort = null;

const getLiveStreamBaseDir = () => join(getConfigValue('workspace'), 'camera', 'live');

// Normalize host value from config by stripping protocol and path parts
const normalizeNvrHost = host => {
    return String(host || '')
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .trim();
};

// Resolve first non-internal IPv4 to generate LAN-accessible URLs
const getLocalLanIp = () => {
    const interfaces = networkInterfaces();
    for (const list of Object.values(interfaces)) {
        for (const entry of list || []) {
            if (entry.family === 'IPv4' && !entry.internal) {
                return entry.address;
            }
        }
    }
    return '127.0.0.1';
};

// Basic MIME mapping for HLS files
const getMimeType = filePath => {
    if (filePath.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
    if (filePath.endsWith('.ts')) return 'video/mp2t';
    return 'application/octet-stream';
};

// Start static HTTP server for live HLS output once per process
const ensureLiveServer = async (port = DEFAULT_STREAM_PORT) => {
    if (server) {
        return { port: serverPort };
    }

    const liveStreamBaseDir = getLiveStreamBaseDir();
    mkdirSync(liveStreamBaseDir, { recursive: true });

    server = createServer((req, res) => {
        const pathname = (req.url || '/').split('?')[0];
        const requested = normalize(join(liveStreamBaseDir, pathname));
        const root = normalize(liveStreamBaseDir + '\\');

        // Prevent path traversal outside live directory
        if (!requested.startsWith(root) && requested !== normalize(liveStreamBaseDir)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
        }

        if (!existsSync(requested)) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }

        res.setHeader('Content-Type', getMimeType(requested));
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        createReadStream(requested).pipe(res);
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => resolve());
    });

    serverPort = port;
    logger.debug(`Camera live HLS server started on port ${serverPort}`);
    return { port: serverPort };
};

// Start or reuse a live HLS relay for a camera channel
export const startCameraLiveRelay = async ({ channel = 0, streamType = 'sub', port = DEFAULT_STREAM_PORT }) => {
    const channelKey = String(channel);
    const existing = activeStreams.get(channelKey);
    if (existing && !existing.process.killed) {
        return {
            channel,
            streamType: existing.streamType,
            hlsUrl: existing.hlsUrl,
            playlistPath: existing.playlistPath,
            alreadyRunning: true
        };
    }

    await ensureLiveServer(port);
    const liveStreamBaseDir = getLiveStreamBaseDir();
    mkdirSync(liveStreamBaseDir, { recursive: true });

    const streamDir = join(liveStreamBaseDir, `ch${channel}`);
    mkdirSync(streamDir, { recursive: true });

    const playlistPath = join(streamDir, 'index.m3u8');
    const segmentPattern = join(streamDir, 'seg_%03d.ts');

    // Read NVR credentials to build RTSP URL directly with package helper
    const hostRaw = getConfigValue('nvr.host');
    const username = getConfigValue('nvr.username');
    const password = getConfigValue('nvr.password');

    if (!hostRaw || !username || !password) {
        throw new Error('NVR not configured. Please add nvr.host, nvr.username, and nvr.password to your config.');
    }

    const host = normalizeNvrHost(hostRaw).replace(/:\d+$/, '');
    if (String(streamType || '').toLowerCase() === 'sub') {
        logger.debug('Reolink RTSP helper generates main profile URL; requested streamType "sub" is ignored for RTSP.');
    }

    const rtspUrlValue = rtspUrl({
        user: String(username),
        pass: String(password),
        host,
        channel: Number(channel) || 0,
        h265: false
    });

    const ffmpegArgs = [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrlValue,
        '-an',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-tune', 'zerolatency',
        '-f', 'hls',
        '-hls_time', '1',
        '-hls_list_size', '4',
        '-hls_flags', 'delete_segments+append_list+independent_segments',
        '-hls_segment_filename', segmentPattern,
        playlistPath
    ];

    // ffmpeg must be installed on host system
    const child = spawn('ffmpeg', ffmpegArgs, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe']
    });

    let startupError = '';
    child.stderr.on('data', chunk => {
        const line = String(chunk || '');
        startupError += line;
    });

    const lanIp = getLocalLanIp();
    const hlsPath = `/ch${channel}/index.m3u8`;
    const hlsUrl = `http://${lanIp}:${serverPort}${hlsPath}`;

    // Wait briefly to detect immediate process failures (bad URL, ffmpeg missing, etc.)
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 1200);

        child.once('error', error => {
            clearTimeout(timeout);
            reject(error);
        });

        child.once('exit', code => {
            clearTimeout(timeout);
            reject(new Error(startupError.trim() || `ffmpeg exited with code ${code}`));
        });
    }).catch(error => {
        if (String(error?.message || '').includes('ENOENT')) {
            throw new Error('ffmpeg is not installed or not in PATH. Please install ffmpeg to enable live streaming.');
        }
        throw error;
    });

    const state = {
        channel,
        streamType,
        process: child,
        playlistPath,
        hlsUrl,
        startedAt: Date.now()
    };

    activeStreams.set(channelKey, state);

    child.once('exit', () => {
        activeStreams.delete(channelKey);
    });

    logger.debug(`Camera live relay started for channel ${channel} (${streamType})`);

    return {
        channel,
        streamType,
        hlsUrl,
        playlistPath,
        alreadyRunning: false
    };
};

// Return current stream state for a channel
export const getCameraLiveRelay = ({ channel = 0 }) => {
    const channelKey = String(channel);
    const state = activeStreams.get(channelKey);
    if (!state) {
        return null;
    }

    return {
        channel: state.channel,
        streamType: state.streamType,
        hlsUrl: state.hlsUrl,
        playlistPath: state.playlistPath,
        startedAt: state.startedAt
    };
};

// Stop one relay or all relays
export const stopCameraLiveRelay = ({ channel } = {}) => {
    if (channel === undefined || channel === null) {
        const channels = [];
        for (const [key, state] of activeStreams.entries()) {
            if (!state.process.killed) {
                state.process.kill('SIGTERM');
            }
            channels.push(Number(key));
            activeStreams.delete(key);
        }
        return { stoppedChannels: channels };
    }

    const channelKey = String(channel);
    const state = activeStreams.get(channelKey);
    if (!state) {
        return { stoppedChannels: [] };
    }

    if (!state.process.killed) {
        state.process.kill('SIGTERM');
    }
    activeStreams.delete(channelKey);

    return { stoppedChannels: [Number(channel)] };
};