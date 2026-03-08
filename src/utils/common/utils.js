import { isAbsolute, relative, resolve, join, normalize, basename } from 'path';
import { homedir } from 'os';
import { CONFIG_PATH, SENSITIVE_FILE_NAMES } from '../../config.js';
import { logger } from './logger.js';

// Expand ~ in paths and resolve relative paths
export const expandPath = path => {
    // Expand ~ to home directory
    if (path.startsWith('~')) {
        return join(homedir(), path.slice(1));
    }

    // Resolve relative paths
    return resolve(path);
};

// Convert Markdown to Telegram-safe HTML
export const markdownToTelegramHtml = text => {
    if (!text) return '';

    // Store code blocks to protect them
    const codeBlocks = [];
    const inlineCodes = [];

    // Extract code blocks
    let result = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
        codeBlocks.push(code);
        return `\x00CB${codeBlocks.length - 1}\x00`;
    });

    // Extract inline code
    result = result.replace(/`([^`]+)`/g, (_, code) => {
        inlineCodes.push(code);
        return `\x00IC${inlineCodes.length - 1}\x00`;
    });

    // Remove headers (# Title -> Title)
    result = result.replace(/^#{1,6}\s+(.+)$/gm, '$1');

    // Remove blockquotes (> text -> text)
    result = result.replace(/^>\s*(.*)$/gm, '$1');

    // Escape HTML special characters
    result = result.replace(/&/g, '&amp;');
    result = result.replace(/</g, '&lt;');
    result = result.replace(/>/g, '&gt;');

    // Convert links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Convert bold **text** or __text__
    result = result.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    result = result.replace(/__(.+?)__/g, '<b>$1</b>');

    // Convert italic _text_ (avoid matching inside words)
    result = result.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, '<i>$1</i>');

    // Convert strikethrough ~~text~~
    result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');

    // Convert bullet lists
    result = result.replace(/^[-*]\s+/gm, '• ');

    // Restore inline code
    for (let i = 0; i < inlineCodes.length; i++) {
        const escaped = inlineCodes[i]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        result = result.replace(`\x00IC${i}\x00`, `<code>${escaped}</code>`);
    }

    // Restore code blocks
    for (let i = 0; i < codeBlocks.length; i++) {
        const escaped = codeBlocks[i]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        result = result.replace(`\x00CB${i}\x00`, `<pre><code>${escaped}</code></pre>`);
    }

    // Return the final result
    return result;
};

// Extract text content from HTML
export const extractTextFromHtml = html => {
    // Remove script and style elements
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Return the cleaned text
    return text;
};

// Centralized path access check for read/write operations
export const isSensitivePath = ({ fullPath, workDir, action = 'write' }) => {
    // If no path provided, treat as sensitive by default
    if (!fullPath) {
        return false;
    }

    // Normalize and check against known sensitive files and patterns
    const normalizedPath = normalize(fullPath).toLowerCase();
    const fileName = basename(normalizedPath);
    const normalizedConfigPath = normalize(CONFIG_PATH).toLowerCase();

    // Block access to sensitive files regardless of action
    if (normalizedPath === normalizedConfigPath || SENSITIVE_FILE_NAMES.includes(fileName) || fileName.startsWith('.env')) {
        return false;
    }

    // Read access only performs sensitive-path protection
    if (action === 'read') {
        return true;
    }

    // Unknown action types are denied by default
    if (action !== 'write') {
        return false;
    }

    // Write access requires a workspace path to enforce scope checks
    if (!workDir) {
        return false;
    }

    // Resolve the relative path from the working directory
    const relativePath = relative(workDir, fullPath);

    // Disallow paths that escape the workspace
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        return false;
    }

    // Allow all writable paths within workspace
    return true;
};

// Generate a unique ID
export const generateUniqueId = (prefix = 'msg') => {
    return `${prefix}_${Date.now()}`;
};

// Pause execution for the given number of milliseconds
export const delay = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Parse a session key into its channel and chatId components
export const parseSessionKey = sessionKey => {
    const separatorIndex = sessionKey.indexOf('_');
    return {
        channel: sessionKey.slice(0, separatorIndex),
        chatId: sessionKey.slice(separatorIndex + 1)
    };
};

// Split message into chunks
export const splitMessageIntoChunks = (text, maxLength) => {
    // Check if splitting is needed
    if (text.length <= maxLength) {
        return [text];
    }

    // Prepare data structures
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');

    // Accumulate lines into chunks
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > maxLength) {
            // Push current chunk and start a new one
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }

            // If a single line is too long, split it
            if (line.length > maxLength) {
                let remaining = line;

                // Split the long line into smaller parts
                while (remaining.length > maxLength) {
                    chunks.push(remaining.slice(0, maxLength));
                    remaining = remaining.slice(maxLength);
                }

                // Start new chunk with remaining part
                currentChunk = remaining + '\n';
            } else {
                currentChunk = line + '\n';
            }
        } else {
            currentChunk += line + '\n';
        }
    }

    // Push any remaining chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    // Return the array of chunks
    return chunks;
};

// Parse JSON with error handling
export const parseJson = jsonString => {
    try {
        return JSON.parse(jsonString);
    } catch {
        return {};
    }
};

// Stringify object to JSON with error handling
export const stringifyJson = value => {
    try {
        return JSON.stringify(value);
    } catch {
        return '{}';
    }
};

// Decode HTML entities in text
export const decodeHtmlEntities = text => {
    return text
        .replace(/&#10;/g, '\n')
        .replace(/&#13;/g, '\r')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
};

// Guess a MIME type from a file extension for common attachment types
export const getMimeTypeFromFileName = fileName => {
    const lower = String(fileName || '').toLowerCase();

    // Basic mapping of common file extensions to MIME types
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.txt')) return 'text/plain';
    if (lower.endsWith('.csv')) return 'text/csv';
    if (lower.endsWith('.json')) return 'application/json';
    if (lower.endsWith('.zip')) return 'application/zip';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.doc')) return 'application/msword';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
    if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    // Default MIME type for unknown extensions
    return 'application/octet-stream';
};

// Split long base64 payloads into MIME-safe line lengths
export const chunkBase64 = value => {
    return value.match(/.{1,76}/g)?.join('\r\n') || '';
};

// Tokenize an argument string while preserving quoted segments
export const tokenizeArgs = text => {
    const input = String(text || '');
    const tokens = [];
    let current = '';
    let quote = null;

    // Scan each character and split on unquoted whitespace
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];

        // Enter quote mode when encountering opening quotes
        if (!quote && (ch === '"' || ch === '\'')) {
            quote = ch;
            continue;
        }

        // Exit quote mode when the same quote type closes
        if (quote && ch === quote) {
            quote = null;
            continue;
        }

        // Whitespace outside quotes delimits tokens
        if (!quote && /\s/.test(ch)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        // Accumulate characters into the current token
        current += ch;
    }

    // Reject malformed input with unclosed quotes
    if (quote) {
        throw new Error('Invalid args: unclosed quote.');
    }

    // Push the trailing token if present
    if (current) {
        tokens.push(current);
    }

    // Return the array of tokens
    return tokens;
};

// Parse YAML-like frontmatter from markdown content
export const parseFrontmatter = content => {
    // Match frontmatter block at the start of the content
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { metadata: {}, body: content };

    // Parse the frontmatter content into a metadata object
    const rawMeta = match[1];
    const body = content.slice(match[0].length).trim();
    const metadata = {};
    let currentKey = null;
    let currentList = null;

    // Process each line of the frontmatter
    for (const line of rawMeta.split(/\r?\n/)) {
        const listItem = line.match(/^\s+-\s+(.+)$/);
        const keyValue = line.match(/^([\w_]+):\s*(.*)$/);

        // Handle list items
        if (listItem && currentKey) {
            currentList.push(listItem[1].trim());
        } else if (keyValue) {
            // Flush previous list key
            if (currentKey && currentList) {
                metadata[currentKey] = currentList;
            }

            // Start new key
            currentKey = keyValue[1];
            const value = keyValue[2].trim();

            // If value is empty, expect a list to follow
            if (value) {
                metadata[currentKey] = value;
                currentKey = null;
                currentList = null;
            } else {
                currentList = [];
            }
        }
    }

    // Flush final key
    if (currentKey && currentList) {
        metadata[currentKey] = currentList;
    }

    // Return the parsed metadata and the remaining body content
    return { metadata, body };
};

// Format milliseconds into a human-readable time string (e.g. "2h 34m 43s")
export const formatTime = ms => {
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
};

// Format a Date object as a local ISO-like datetime string (e.g. "2026-03-03T14:05:00.000")
export const formatLocalDateTimeString = date => {
    // Extract components of the local date and time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    // Return in ISO-like format with local time and milliseconds
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
};

// Convert a local timestamp string (e.g. "2026-03-05 06:45:48" or "2026-03-05T06:45:48") to Reolink date object
export const timestampStringToReolinkDate = timestamp => {
    // Parse the timestamp string into a Date object
    const date = new Date(String(timestamp).replace(' ', 'T'));
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid timestamp string: "${timestamp}"`);
    }

    // Convert the Date object into Reolink's date format
    return {
        year: date.getFullYear(),
        mon: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        min: date.getMinutes(),
        sec: date.getSeconds()
    };
};

// Convert a Reolink date object { year, mon, day, hour, min, sec } to local timestamp string (e.g. "2025-01-15T20:00:00")
export const reolinkDateToTimestampString = reolinkDate => {
    const pad = number => String(number).padStart(2, '0');
    return `${reolinkDate.year}-${pad(reolinkDate.mon)}-${pad(reolinkDate.day)}T${pad(reolinkDate.hour)}:${pad(reolinkDate.min)}:${pad(reolinkDate.sec)}`;
};

// Validate a start/end datetime range using ISO-like local datetime strings
export const validateCameraInputDates = ({ startTime, endTime }) => {
    // Convert input strings to Date objects
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate the start time
    if (isNaN(start.getTime())) {
        return { success: false, message: `Invalid startTime: "${startTime}". Must be a valid ISO 8601 datetime string.` };
    }

    // Validate the end time
    if (isNaN(end.getTime())) {
        return { success: false, message: `Invalid endTime: "${endTime}". Must be a valid ISO 8601 datetime string.` };
    }

    // Ensure start time is before end time
    if (start >= end) {
        return { success: false, message: 'startTime must be before endTime.' };
    }

    // Return success with parsed Date objects
    return { success: true, start, end };
};

// Handle tool execution errors with standardized format
export const handleToolError = ({ error, message }) => {
    // Construct a detailed error message
    let errorMessage;
    if (error) {
        const errorDetail = error instanceof Error ? error.message : String(error);
        errorMessage = `${message}: ${errorDetail}`;
    } else {
        errorMessage = message;
    }

    // Log the error
    logger.error(errorMessage);

    // Return standardized error response
    return {
        success: false,
        error: errorMessage
    };
};

// Handle tool execution success with standardized format
export const handleToolResponse = output => {
    return {
        success: true,
        output
    };
};