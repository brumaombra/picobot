import { mkdir, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { markdownToTelegramHtml, splitMessageIntoChunks, parseSessionKey, getFileExtensionFromMimeType } from '../../utils/common/utils.js';
import { getConfigValue } from '../../config/config.js';
import { TELEGRAM_MAX_MESSAGE_LENGTH } from '../../config.js';

// Map of supported file extensions to Telegram send methods and types
const OUTBOUND_FILE_TYPE_MAP = {
    '.jpg': ['sendPhoto', 'image'],
    '.jpeg': ['sendPhoto', 'image'],
    '.png': ['sendPhoto', 'image'],
    '.webp': ['sendPhoto', 'image'],
    '.bmp': ['sendPhoto', 'image'],
    '.gif': ['sendAnimation', 'animation'],
    '.mp4': ['sendVideo', 'video'],
    '.mov': ['sendVideo', 'video'],
    '.avi': ['sendVideo', 'video'],
    '.mkv': ['sendVideo', 'video'],
    '.webm': ['sendVideo', 'video'],
    '.ogg': ['sendVoice', 'voice'],
    '.mp3': ['sendAudio', 'audio'],
    '.wav': ['sendAudio', 'audio'],
    '.m4a': ['sendAudio', 'audio'],
    '.flac': ['sendAudio', 'audio'],
    '.aac': ['sendAudio', 'audio']
};

// Sanitize file names so downloaded Telegram files stay safe and path-stable
const sanitizeFileName = value => {
    return String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
};

// Build the shared runtime metadata from one Telegram message
const buildInboundMetadata = (msg, extra = {}) => ({
    username: msg.from.username,
    firstName: msg.from.first_name,
    lastName: msg.from.last_name,
    messageId: msg.message_id,
    ...extra
});

// Detect supported Telegram media and return the download descriptor
const getMediaDescriptor = msg => {
    // Check for supported media types in order of preference
    if (msg.photo?.length) {
        const largestPhoto = msg.photo[msg.photo.length - 1];
        return {
            mediaType: 'photo',
            fileId: largestPhoto.file_id,
            fileName: `${largestPhoto.file_unique_id}.jpg`,
            mimeType: 'image/jpeg'
        };
    } else if (msg.document) {
        return {
            mediaType: 'document',
            fileId: msg.document.file_id,
            fileName: msg.document.file_name,
            mimeType: msg.document.mime_type
        };
    } else if (msg.video) {
        return {
            mediaType: 'video',
            fileId: msg.video.file_id,
            fileName: msg.video.file_name || `${msg.video.file_unique_id}.mp4`,
            mimeType: msg.video.mime_type
        };
    } else if (msg.audio) {
        return {
            mediaType: 'audio',
            fileId: msg.audio.file_id,
            fileName: msg.audio.file_name || `${msg.audio.file_unique_id}.mp3`,
            mimeType: msg.audio.mime_type
        };
    } else if (msg.voice) {
        return {
            mediaType: 'voice',
            fileId: msg.voice.file_id,
            fileName: `${msg.voice.file_unique_id}.ogg`,
            mimeType: msg.voice.mime_type || 'audio/ogg'
        };
    } else if (msg.animation) {
        return {
            mediaType: 'animation',
            fileId: msg.animation.file_id,
            fileName: msg.animation.file_name || `${msg.animation.file_unique_id}.gif`,
            mimeType: msg.animation.mime_type
        };
    } else {
        return null;
    }
};

// Build one plain-text inbound runtime message from a Telegram message
export const buildTextInboundMessage = msg => {
    const chatId = msg.chat.id.toString();
    return {
        sessionKey: `telegram_${chatId}`,
        role: 'user',
        content: msg.text,
        replyToId: msg.message_id,
        metadata: buildInboundMetadata(msg)
    };
};

// Save one Telegram-uploaded file into the Picobot workspace and return metadata about it
const downloadTelegramFile = async ({ bot, fileId, fileName, mimeType }) => {
    // Get the file link and download the file data
    const fileLink = await bot.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.toString());
    if (!response.ok) {
        throw new Error(`Telegram download failed with status ${response.status}`);
    }

    // Create the uploads directory
    const bytes = Buffer.from(await response.arrayBuffer());
    const uploadDir = join(getConfigValue('workspace'), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Sanitize the file name and ensure it has an extension
    const safeName = sanitizeFileName(fileName || basename(fileLink.pathname) || fileId);
    const hasExtension = Boolean(extname(safeName));
    const inferredExtension = !hasExtension && mimeType ? getFileExtensionFromMimeType(mimeType) : '';
    const finalName = `${Date.now()}_${safeName}${hasExtension ? '' : inferredExtension}`;
    const fullPath = join(uploadDir, finalName);

    // Save the file to disk
    await writeFile(fullPath, bytes);

    // Return the file metadata
    return {
        fileId,
        filePath: fullPath,
        bytes: bytes.length,
        mimeType: mimeType || null,
        originalFileName: fileName || null
    };
};

// Convert one Telegram media update into the shared runtime message shape
export const buildMediaInboundMessage = async ({ bot, msg }) => {
    // Get the media descriptor for this message
    const descriptor = getMediaDescriptor(msg);
    if (!descriptor) {
        return null;
    }

    // Download the media file and build the inbound message
    const saved = await downloadTelegramFile({ bot, ...descriptor });
    const chatId = msg.chat.id.toString();
    const caption = String(msg.caption || '').trim();
    const content = caption ? `${caption}\n\nAttached media saved at: ${saved.filePath}` : `Attached media saved at: ${saved.filePath}`;

    // Return the standardized inbound message object
    return {
        sessionKey: `telegram_${chatId}`,
        role: 'user',
        content,
        replyToId: msg.message_id,
        metadata: buildInboundMetadata(msg, { mediaType: descriptor.mediaType, media: saved })
    };
};

// Send one Squadforge outbound message to Telegram
export const sendTelegramOutboundMessage = async ({ bot, stopTyping, message, logger }) => {
    // Extract the chat ID from the session key
    const { channel, chatId } = parseSessionKey(message.sessionKey);
    if (channel !== 'telegram') {
        return;
    }

    // Stop typing indicator
    stopTyping(chatId);

    try {
        // Send it with the appropriate method
        if (message.file) { // File attachment
            // Prepare the file and options
            const replyParams = message.replyToId ? { message_id: parseInt(message.replyToId, 10) } : undefined;
            const options = { caption: message.file.caption || message.content, parse_mode: 'HTML', reply_parameters: replyParams };
            const source = { source: message.file.path };
            const extension = message.file.path.slice(message.file.path.lastIndexOf('.')).toLowerCase();
            const [sendMethod, fileType] = OUTBOUND_FILE_TYPE_MAP[extension] ?? ['sendDocument', 'file'];

            // Send the file with the appropriate method
            await bot.telegram[sendMethod](chatId, source, options);
            logger.debug(`Sent ${fileType} to ${message.sessionKey}: ${message.file.path}`);
            return;
        } else { // Regular text message
            // Split long messages into chunks and send sequentially
            const htmlContent = markdownToTelegramHtml(message.content);
            const chunks = splitMessageIntoChunks(htmlContent, TELEGRAM_MAX_MESSAGE_LENGTH);
            for (const chunk of chunks) {
                await bot.telegram.sendMessage(chatId, chunk, {
                    parse_mode: 'HTML',
                    reply_parameters: message.replyToId ? { message_id: parseInt(message.replyToId, 10) } : undefined
                });
            }

            // Log the sent message
            logger.debug(`Sent message to ${message.sessionKey}`);
        }
    } catch (error) {
        // Log the error
        logger.error(`Failed to send telegram message: ${error}`);

        try {
            await bot.telegram.sendMessage(chatId, message.content.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH));
        } catch (fallbackError) {
            logger.error(`Fallback send also failed: ${fallbackError}`);
        }
    }
};