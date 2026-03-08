import { message } from 'telegraf/filters';
import { mkdir, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { logger } from '../../utils/common/logger.js';
import { pushInbound } from '../../bus/message-bus.js';
import { startTyping } from '../helpers/typing.js';
import { WORKSPACE_DIR } from '../../config.js';
import { getFileExtensionFromMimeType } from '../../utils/common/utils.js';

// Sanitize file names to avoid invalid/path-breaking characters
const sanitizeFileName = value => {
    return String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
};

// Save a Telegram file to the workspace uploads folder and return metadata
const downloadTelegramFile = async ({ bot, fileId, fileName, mimeType }) => {
    // Resolve Telegram file URL
    const fileLink = await bot.telegram.getFileLink(fileId);

    // Download bytes via the signed Telegram file URL
    const response = await fetch(fileLink.toString());
    if (!response.ok) {
        throw new Error(`Telegram download failed with status ${response.status}`);
    }

    // Read the response as a buffer for saving to disk
    const bytes = Buffer.from(await response.arrayBuffer());

    // Build deterministic upload location inside workspace
    const uploadDir = join(WORKSPACE_DIR, 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Sanitize the original file name and ensure it has a valid extension
    const safeName = sanitizeFileName(fileName || basename(fileLink.pathname) || fileId);
    const hasExt = Boolean(extname(safeName));
    const inferredExt = !hasExt && mimeType ? getFileExtensionFromMimeType(mimeType) : '';
    const finalName = `${Date.now()}_${safeName}${hasExt ? '' : inferredExt}`;
    const fullPath = join(uploadDir, finalName);

    // Persist the downloaded file
    await writeFile(fullPath, bytes);

    // Return metadata about the saved file for agent use
    return {
        fileId,
        filePath: fullPath,
        bytes: bytes.length,
        mimeType: mimeType || null,
        originalFileName: fileName || null
    };
};

// Build an inbound payload for media messages
const buildMediaInbound = async ({ bot, msg, chatId }) => {
    // Determine the type of media in the message
    let mediaType = null;
    if (msg.photo) {
        mediaType = 'photo';
    } else if (msg.document) {
        mediaType = 'document';
    } else if (msg.video) {
        mediaType = 'video';
    } else if (msg.audio) {
        mediaType = 'audio';
    } else if (msg.voice) {
        mediaType = 'voice';
    } else if (msg.animation) {
        mediaType = 'animation';
    }

    // Unsupported media types are ignored by this handler
    if (!mediaType) {
        return null;
    }

    // Extract file descriptor based on media type
    let descriptor;
    if (mediaType === 'photo') {
        const largestPhoto = msg.photo[msg.photo.length - 1];
        descriptor = {
            fileId: largestPhoto.file_id,
            fileName: `${largestPhoto.file_unique_id}.jpg`,
            mimeType: 'image/jpeg'
        };
    } else if (mediaType === 'document') {
        descriptor = {
            fileId: msg.document.file_id,
            fileName: msg.document.file_name,
            mimeType: msg.document.mime_type
        };
    } else if (mediaType === 'video') {
        descriptor = {
            fileId: msg.video.file_id,
            fileName: msg.video.file_name || `${msg.video.file_unique_id}.mp4`,
            mimeType: msg.video.mime_type
        };
    } else if (mediaType === 'audio') {
        descriptor = {
            fileId: msg.audio.file_id,
            fileName: msg.audio.file_name || `${msg.audio.file_unique_id}.mp3`,
            mimeType: msg.audio.mime_type
        };
    } else if (mediaType === 'voice') {
        descriptor = {
            fileId: msg.voice.file_id,
            fileName: `${msg.voice.file_unique_id}.ogg`,
            mimeType: msg.voice.mime_type || 'audio/ogg'
        };
    } else {
        descriptor = {
            fileId: msg.animation.file_id,
            fileName: msg.animation.file_name || `${msg.animation.file_unique_id}.gif`,
            mimeType: msg.animation.mime_type
        };
    }

    // Download and persist media to workspace
    const saved = await downloadTelegramFile({
        bot,
        chatId,
        fileId: descriptor.fileId,
        fileName: descriptor.fileName,
        mimeType: descriptor.mimeType
    });

    // Build a message content that includes the original caption (if any) and the saved file path
    const caption = String(msg.caption || '').trim();
    const content = caption ? `${caption}\n\nAttached media saved at: ${saved.filePath}` : `Attached media saved at: ${saved.filePath}`;

    // Construct inbound message object for agent processing
    return {
        sessionKey: `telegram_${chatId}`,
        content,
        metadata: {
            username: msg.from.username,
            firstName: msg.from.first_name,
            lastName: msg.from.last_name,
            messageId: msg.message_id,
            mediaType,
            media: saved
        }
    };
};

// Register the text message handler
export const registerTextHandler = bot => {
    // Handle incoming text messages
    bot.on(message('text'), async context => {
        // Extract message details
        const msg = context.message;
        const senderId = msg.from.id.toString();
        const chatId = msg.chat.id.toString();

        // Start typing indicator
        startTyping(bot, chatId);

        // Construct inbound message object
        const inbound = {
            sessionKey: `telegram_${chatId}`,
            content: msg.text,
            metadata: {
                username: msg.from.username,
                firstName: msg.from.first_name,
                lastName: msg.from.last_name,
                messageId: msg.message_id
            }
        };

        // Publish inbound message
        logger.info(`Received message from telegram_${senderId}`);
        pushInbound(inbound);
    });

    // Handle media uploads by saving files locally and forwarding paths to the agent
    bot.on(message(), async context => {
        const msg = context.message;
        const senderId = msg.from?.id?.toString();
        const chatId = msg.chat?.id?.toString();

        // Skip if this update is not a supported media message
        if (!msg || !chatId || (!msg.photo && !msg.document && !msg.video && !msg.audio && !msg.voice && !msg.animation)) {
            return;
        }

        // Start typing indicator for media messages too
        startTyping(bot, chatId);

        try {
            // Build the inbound message
            const inbound = await buildMediaInbound({ bot, msg, chatId });
            if (!inbound) {
                return;
            }

            // Publish inbound message
            logger.info(`Received media message from telegram_${senderId}`);
            pushInbound(inbound);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to process inbound Telegram media: ${errorMessage}`);
            await context.reply(`Sorry, I couldn't process that media file: ${errorMessage}`);
        }
    });
};