import { logger } from '../../utils/logger.js';
import { getGmailClient } from '../../utils/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// Gmail read tool
export const gmailReadTool = {
    // Tool definition
    name: 'gmail_read',
    description: 'Read Gmail message content.',
    parameters: {
        type: 'object',
        properties: {
            messageId: {
                type: 'string',
                description: 'Message ID.'
            },
            format: {
                type: 'string',
                enum: ['full', 'metadata', 'minimal'],
                description: 'Response format.'
            }
        },
        required: ['messageId']
    },

    // Main execution function
    execute: async args => {
        const { messageId, format = 'full' } = args;

        // Log read attempt
        logger.debug(`Reading Gmail message: ${messageId}`);

        try {
            // Get Gmail client
            const gmail = await getGmailClient();

            // Get message details
            const response = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: format
            });

            // Format output based on format type
            let output;
            if (format === 'full') {
                // Extract headers
                const headers = {};
                response.data.payload?.headers?.forEach(h => {
                    headers[h.name] = h.value;
                });

                // Extract body
                let body = '';
                const getBody = (part) => {
                    if (part.mimeType === 'text/plain' && part.body?.data) {
                        return Buffer.from(part.body.data, 'base64').toString('utf-8');
                    }
                    if (part.parts) {
                        for (const subPart of part.parts) {
                            const result = getBody(subPart);
                            if (result) return result;
                        }
                    }
                    return null;
                };

                // Get body content
                body = getBody(response.data.payload) || '';

                // Construct output
                output = {
                    id: response.data.id,
                    threadId: response.data.threadId,
                    subject: headers.Subject || '(No subject)',
                    from: headers.From || '',
                    to: headers.To || '',
                    date: headers.Date || '',
                    body: body,
                    snippet: response.data.snippet
                };
            } else {
                output = response.data;
            }

            // Return the message details
            return handleToolResponse(output);
        } catch (error) {
            return handleToolError({ error, message: 'Gmail read failed' });
        }
    }
};