import { logger } from '../../utils/logger.js';
import { getGmailClient } from '../../utils/google-client.js';
import { decodeHtmlEntities, handleToolError, handleToolResponse } from '../../utils/utils.js';

// Gmail search tool
export const gmailSearchTool = {
    // Tool definition
    name: 'gmail_search',
    description: 'Search Gmail messages.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query.'
            },
            maxResults: {
                type: 'number',
                description: 'Max results (default: 10).'
            }
        },
        required: ['query']
    },

    // Main execution function
    execute: async args => {
        const { query, maxResults = 10 } = args;

        // Log search attempt
        logger.debug(`Searching Gmail: ${query}`);

        try {
            // Get Gmail client
            const gmail = await getGmailClient();

            // List messages matching query
            const listResponse = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: Math.min(maxResults, 50)
            });

            // Check if any messages found
            if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
                return handleToolResponse('No messages found matching the query.');
            }

            // Fetch full metadata for each message
            const messages = await Promise.all(
                listResponse.data.messages.map(async msg => {
                    const details = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'metadata',
                        metadataHeaders: ['From', 'To', 'Subject', 'Date']
                    });
                    return details.data;
                })
            );

            // Format output
            const formatted = messages.map(msg => {
                const headers = {};

                // Extract relevant headers
                msg.payload.headers.forEach(h => {
                    headers[h.name] = h.value;
                });

                // Return formatted message info
                return {
                    id: msg.id,
                    threadId: msg.threadId,
                    subject: headers.Subject || '(No subject)',
                    from: headers.From || '',
                    to: headers.To || '',
                    date: headers.Date || '',
                    snippet: msg.snippet
                };
            });

            // Return the list of messages
            return handleToolResponse(formatted);
        } catch (error) {
            return handleToolError({ error, message: 'Gmail search failed' });
        }
    }
};

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

// Gmail send tool
export const gmailSendTool = {
    // Tool definition
    name: 'gmail_send',
    description: 'Send email via Gmail (supports plain text and HTML).',
    parameters: {
        type: 'object',
        properties: {
            to: {
                type: 'string',
                description: 'Recipient email(s).'
            },
            subject: {
                type: 'string',
                description: 'Email subject.'
            },
            body: {
                type: 'string',
                description: 'Email body.'
            },
            html: {
                type: 'boolean',
                description: 'Send as HTML email (default: false for plain text).'
            },
            cc: {
                type: 'string',
                description: 'CC recipients.'
            },
            bcc: {
                type: 'string',
                description: 'BCC recipients.'
            }
        },
        required: ['to', 'subject', 'body']
    },

    // Main execution function
    execute: async args => {
        const { to, subject, body, html = false, cc, bcc } = args;

        // Log send attempt
        logger.debug(`Sending Gmail to ${to}: ${subject}`);

        try {
            // Get Gmail client
            const gmail = await getGmailClient();

            // Process body based on email type
            let safeBody = (body || '').replace(/\r?\n/g, '\r\n'); // Normalize line endings for all emails

            // For plain text emails, also decode HTML entities
            if (!html) {
                safeBody = decodeHtmlEntities(safeBody);
            }

            // Build headers
            const headers = [
                `From: me`,
                `To: ${to}`,
                cc ? `Cc: ${cc}` : null,
                bcc ? `Bcc: ${bcc}` : null,
                `Subject: ${subject}`,
                `MIME-Version: 1.0`,
                `Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=UTF-8`
            ].filter(Boolean);

            // Build full raw message (CRITICAL: blank line between headers and body)
            const rawMessage =
                headers.join('\r\n') +
                '\r\n\r\n' +
                safeBody;

            // Encode to base64url (Gmail API requirement)
            const encodedMessage = Buffer.from(rawMessage, 'utf-8')
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Send the email
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            });

            // Return success with sent message ID
            return handleToolResponse(`Email sent successfully. Message ID: ${response.data.id}`);
        } catch (error) {
            return handleToolError({ error, message: 'Gmail send failed' });
        }
    }
};

// Gmail labels tool
export const gmailLabelsTool = {
    // Tool definition
    name: 'gmail_list_labels',
    description: 'List Gmail labels.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        // Log list labels attempt
        logger.debug('Listing Gmail labels');

        try {
            // Get Gmail client
            const gmail = await getGmailClient();

            // List all labels
            const response = await gmail.users.labels.list({
                userId: 'me'
            });

            // Format output
            const labels = response.data.labels.map(label => ({
                id: label.id,
                name: label.name,
                type: label.type
            }));

            // Return the list of labels
            return handleToolResponse(labels);
        } catch (error) {
            return handleToolError({ error, message: 'Gmail labels list failed' });
        }
    }
};