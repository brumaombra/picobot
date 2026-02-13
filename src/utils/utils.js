import { isAbsolute, relative, resolve, join } from 'path';
import { homedir } from 'os';
import { SHELL_BLOCKED_COMMANDS } from '../config.js';
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

// Check if a path is within the workspace directory
export const checkPathForWrite = ({ fullPath, workDir }) => {
    // Resolve the relative path from the working directory
    const relativePath = relative(workDir, fullPath);

    // Disallow paths that escape the workspace
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        return false;
    }

    // Allow all paths within workspace
    return true;
};

// Check if a shell command is safe to execute
export const checkShellCommand = ({ command, workDir }) => {
    // Check for blocked dangerous commands
    if (SHELL_BLOCKED_COMMANDS.some(item => command.toLowerCase().includes(item))) {
        return {
            safe: false,
            reason: 'Command blocked for safety reasons'
        };
    }

    // Check for unauthorized file writes
    const writePatterns = [
        /(?:^|[;&|]\s*)(?:\w+\s+)*([^\s>]+)\s*[>&]*>/g, // Redirections: >, >>, 2>, &>
        /(?:^|[;&|]\s*)(mkdir|touch|cp|mv|ln)\s+([^;&|]+)/g, // mkdir, touch, cp, mv, ln
        /(?:^|[;&|]\s*)(echo|cat|printf)\s+([^;&|]*)\s*[>&]*>/g, // echo/cat with redirection
        /(?:^|[;&|]\s*)dd\s+.*of=([^;&|\s]+)/g, // dd command
        /(?:^|[;&|]\s*)tee\s+([^;&|]+)/g // tee command
    ];

    // Check each pattern for potential file writes
    for (const pattern of writePatterns) {
        let match;

        // Use a loop to find all matches for the current pattern
        while ((match = pattern.exec(command)) !== null) {
            // Extract the file path (usually the last capture group)
            const filePath = match[match.length - 1].trim();

            // Skip if it's not a file path (e.g., a flag or option)
            if (filePath.startsWith('-') || (!filePath.includes('/') && !filePath.includes('\\'))) {
                continue;
            }

            // Resolve the full path
            const fullPath = resolve(workDir, filePath);

            // Check if this path is allowed for writing
            if (!checkPathForWrite({ fullPath, workDir })) {
                return {
                    safe: false,
                    reason: `Command attempts to write to unauthorized path: ${filePath}`
                };
            }
        }
    }

    // If no issues found, command is considered safe
    return { safe: true };
};

// Generate a unique ID
export const generateUniqueId = (prefix = 'msg') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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