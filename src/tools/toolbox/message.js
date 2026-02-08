import { logger } from '../../utils/logger.js';
import { sendOutbound } from '../../bus/message-bus.js';

// Message tool
export const messageTool = {
    // Tool definition
    name: 'message',
    description: 'Send message to user through their channel (Telegram, etc.). Use for status updates during long operations, clarifying questions, intermediate results, or errors needing attention. Final results sent automatically - only use for mid-task communication. Supports markdown.',
    parameters: {
        type: 'object',
        properties: {
            content: {
                type: 'string',
                description: 'Message text with optional markdown: **bold**, *italic*, `code`, ```blocks```, [links](url), lists. Keep clear and concise.'
            }
        },
        required: ['content']
    },

    // Main execution function
    execute: async (args, context) => {
        const content = args.content;

        // Validate the channel context
        if (!context?.channel || !context?.chatId) {
            return {
                success: false,
                output: '',
                error: 'No channel context available'
            };
        }

        // Create the outbound message
        const outbound = {
            channel: context.channel,
            chatId: context.chatId,
            content
        };

        // Publish outbound message
        sendOutbound(outbound);
        logger.debug(`Sent message to ${context.channel}:${context.chatId}`);

        // Return success
        return {
            success: true,
            output: 'Message sent successfully'
        };
    }
};