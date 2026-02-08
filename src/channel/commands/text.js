import { message } from 'telegraf/filters';
import { logger } from '../../utils/logger.js';
import { pushInbound } from '../../bus/message-bus.js';
import { generateUniqueId } from '../../utils/utils.js';
import { startTyping } from '../helpers/typing.js';

// Register the text message handler
export const registerTextHandler = bot => {
    bot.on(message('text'), async context => {
        // Extract message details
        const msg = context.message;
        const senderId = msg.from.id.toString();
        const chatId = msg.chat.id.toString();

        // Start typing indicator
        startTyping(bot, chatId);

        // Construct inbound message object
        const inbound = {
            id: generateUniqueId('msg'),
            channel: 'telegram',
            chatId,
            senderId,
            content: msg.text,
            timestamp: new Date(msg.date * 1000),
            sessionKey: `telegram_${chatId}`,
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
};