import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { mkdir, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { logger } from '../utils/common/logger.js';
import { markdownToTelegramHtml, splitMessageIntoChunks, parseSessionKey, getFileExtensionFromMimeType } from '../utils/common/utils.js';
import { getConfigValue } from '../config/config.js';
import { registerStartCommand } from './commands/start.js';
import { registerModelsCommand } from './commands/models.js';
import { registerModelCommand } from './commands/model.js';
import { registerNewCommand } from './commands/new.js';
import { stopTyping, startTyping } from './helpers/typing.js';
import { authMiddleware } from './helpers/auth.js';
import { TELEGRAM_MAX_MESSAGE_LENGTH } from '../config.js';

let bot = null;
let running = false;
let inboundRuntimeHandler = null;

// Sanitize file names so downloaded Telegram files stay safe and path-stable.
const sanitizeFileName = value => {
    return String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
};

// Save one Telegram-uploaded file into the Picobot workspace and return metadata about it.
const downloadTelegramFile = async ({ fileId, fileName, mimeType }) => {
    const fileLink = await bot.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.toString());
    if (!response.ok) {
        throw new Error(`Telegram download failed with status ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const uploadDir = join(getConfigValue('workspace'), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const safeName = sanitizeFileName(fileName || basename(fileLink.pathname) || fileId);
    const hasExtension = Boolean(extname(safeName));
    const inferredExtension = !hasExtension && mimeType ? getFileExtensionFromMimeType(mimeType) : '';
    const finalName = `${Date.now()}_${safeName}${hasExtension ? '' : inferredExtension}`;
    const fullPath = join(uploadDir, finalName);

    await writeFile(fullPath, bytes);

    return {
        fileId,
        filePath: fullPath,
        bytes: bytes.length,
        mimeType: mimeType || null,
        originalFileName: fileName || null
    };
};

// Convert one Telegram media update into the shared runtime message shape.
const buildMediaInboundMessage = async msg => {
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

    if (!mediaType) {
        return null;
    }

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

    const saved = await downloadTelegramFile(descriptor);
    const chatId = msg.chat.id.toString();
    const caption = String(msg.caption || '').trim();
    const content = caption ? `${caption}\n\nAttached media saved at: ${saved.filePath}` : `Attached media saved at: ${saved.filePath}`;

    return {
        sessionKey: `telegram_${chatId}`,
        role: 'user',
        content,
        replyToId: msg.message_id,
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

// Feed one inbound Telegram message into the configured Squadforge runtime.
const deliverInboundRuntimeMessage = message => {
    if (typeof inboundRuntimeHandler !== 'function') {
        logger.warn('Received a Telegram message before the Squadforge runtime was attached.');
        return;
    }

    inboundRuntimeHandler(message);
};

// Send one Squadforge outbound message to Telegram.
const sendTelegramOutboundMessage = async message => {
    const { channel, chatId } = parseSessionKey(message.sessionKey);
    if (channel !== 'telegram') {
        return;
    }

    stopTyping(chatId);

    try {
        if (message.file) {
            const replyParams = message.replyToId ? { message_id: parseInt(message.replyToId, 10) } : undefined;
            const options = {
                caption: message.file.caption || message.content,
                parse_mode: 'HTML',
                reply_parameters: replyParams
            };
            const source = { source: message.file.path };
            const extension = message.file.path.slice(message.file.path.lastIndexOf('.')).toLowerCase();
            const fileTypeMap = {
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
            const [sendMethod, fileType] = fileTypeMap[extension] ?? ['sendDocument', 'file'];

            await bot.telegram[sendMethod](chatId, source, options);
            logger.debug(`Sent ${fileType} to ${message.sessionKey}: ${message.file.path}`);
            return;
        }

        const htmlContent = markdownToTelegramHtml(message.content);
        const chunks = splitMessageIntoChunks(htmlContent, TELEGRAM_MAX_MESSAGE_LENGTH);
        for (const chunk of chunks) {
            await bot.telegram.sendMessage(chatId, chunk, {
                parse_mode: 'HTML',
                reply_parameters: message.replyToId ? { message_id: parseInt(message.replyToId, 10) } : undefined
            });
        }

        logger.debug(`Sent message to ${message.sessionKey}`);
    } catch (error) {
        logger.error(`Failed to send telegram message: ${error}`);

        try {
            await bot.telegram.sendMessage(chatId, message.content.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH));
        } catch (fallbackError) {
            logger.error(`Fallback send also failed: ${fallbackError}`);
        }
    }
};

// Register the Telegram auth, commands, and runtime-backed chat handlers.
const setupHandlers = () => {
    const allowedUsers = getConfigValue('telegram.allowedUsers');
    bot.use((context, next) => authMiddleware(context, next, allowedUsers));

    registerStartCommand(bot);
    registerModelsCommand(bot);
    registerModelCommand(bot);
    registerNewCommand(bot);

    bot.on(message('text'), async context => {
        const msg = context.message;
        const chatId = msg.chat.id.toString();

        startTyping(bot, chatId);
        deliverInboundRuntimeMessage({
            sessionKey: `telegram_${chatId}`,
            role: 'user',
            content: msg.text,
            replyToId: msg.message_id,
            metadata: {
                username: msg.from.username,
                firstName: msg.from.first_name,
                lastName: msg.from.last_name,
                messageId: msg.message_id
            }
        });
    });

    bot.on(message(), async context => {
        const msg = context.message;
        const chatId = msg.chat?.id?.toString();

        if (!msg || !chatId || (!msg.photo && !msg.document && !msg.video && !msg.audio && !msg.voice && !msg.animation)) {
            return;
        }

        startTyping(bot, chatId);

        try {
            const inboundMessage = await buildMediaInboundMessage(msg);
            if (inboundMessage) {
                deliverInboundRuntimeMessage(inboundMessage);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to process inbound Telegram media: ${errorMessage}`);
            await context.reply(`Sorry, I couldn't process that media file: ${errorMessage}`);
        }
    });
};

// Initialize the Telegram adapter by binding it to a Squadforge leader agent.
export const initTelegram = leaderAgent => {
    const token = getConfigValue('telegram.token');
    bot = new Telegraf(token);
    running = false;
    inboundRuntimeHandler = null;

    leaderAgent.onMessage(handler => {
        inboundRuntimeHandler = handler;
        return () => {
            inboundRuntimeHandler = null;
        };
    });
    leaderAgent.sendMessage(sendTelegramOutboundMessage);

    setupHandlers();
};

// Register the slash commands exposed by the Telegram bot.
const registerCommands = async () => {
    try {
        await bot.telegram.setMyCommands([
            { command: 'start', description: 'Start conversation with the bot' },
            { command: 'models', description: 'List available AI models' },
            { command: 'model', description: 'Switch to a specific model' },
            { command: 'new', description: 'Start a new conversation (clear history)' }
        ]);
        logger.info('Bot commands registered with Telegram');
    } catch (error) {
        logger.error(`Failed to register bot commands: ${error}`);
    }
};

// Start long-polling Telegram updates.
export const startTelegram = async () => {
    if (running) {
        return;
    }

    logger.info('Starting Telegram bot...');
    running = true;

    await bot.launch({
        dropPendingUpdates: true
    });

    const botInfo = await bot.telegram.getMe();
    logger.info(`Telegram bot @${botInfo.username} connected`);
    await registerCommands();
};

// Stop Telegram polling and clear adapter state.
export const stopTelegram = async () => {
    if (!running) {
        return;
    }

    logger.info('Stopping Telegram bot...');
    running = false;
    inboundRuntimeHandler = null;
    bot.stop('SIGTERM');
};