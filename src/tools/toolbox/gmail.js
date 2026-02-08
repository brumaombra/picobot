import { logger } from '../../utils/logger.js';
import { getGmailClient } from '../../utils/google-client.js';

// Gmail search tool
export const gmailSearchTool = {
    // Tool definition
    name: 'gmail_search',
    description: 'Search Gmail messages with query. Supports Gmail search operators (from:, to:, subject:, after:, before:, has:attachment, is:unread, etc.). Returns list of matching emails with id, subject, from, date, snippet.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Gmail search query (e.g., "from:john subject:invoice after:2024/01/01", "is:unread has:attachment"). Use Gmail search operators.'
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10, max: 50).'
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
                return {
                    success: true,
                    output: 'No messages found matching the query.'
                };
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

            // Return success with formatted results
            return {
                success: true,
                output: JSON.stringify(formatted, null, 2)
            };
        } catch (error) {
            logger.error(`Gmail search error: ${error.message}`);
            return {
                success: false,
                output: '',
                error: `Gmail search failed: ${error.message}`
            };
        }
    }
};

// Gmail read tool
export const gmailReadTool = {
    // Tool definition
    name: 'gmail_read',
    description: 'Read full content of a specific Gmail message by ID. Returns email headers (from, to, subject, date), body content (plain text or HTML), and attachments list.',
    parameters: {
        type: 'object',
        properties: {
            messageId: {
                type: 'string',
                description: 'Gmail message ID (obtained from gmail_search results).'
            },
            format: {
                type: 'string',
                description: 'Response format: "full" (complete message), "metadata" (headers only), or "minimal" (ID and labels). Default: "full".'
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

            // Return success with formatted results
            return {
                success: true,
                output: JSON.stringify(output, null, 2)
            };
        } catch (error) {
            logger.error(`Gmail read error: ${error.message}`);
            return {
                success: false,
                output: '',
                error: `Gmail read failed: ${error.message}`
            };
        }
    }
};

// Gmail send tool
export const gmailSendTool = {
    // Tool definition
    name: 'gmail_send',
    description: 'Send email via Gmail as plain text. Supports CC/BCC recipients. Returns sent message ID on success.',
    parameters: {
        type: 'object',
        properties: {
            to: {
                type: 'string',
                description: 'Recipient email address or comma-separated list (e.g., "john@example.com, jane@example.com").'
            },
            subject: {
                type: 'string',
                description: 'Email subject line.'
            },
            body: {
                type: 'string',
                description: 'Email body content in plain text.'
            },
            cc: {
                type: 'string',
                description: 'CC recipients (comma-separated email addresses). Optional.'
            },
            bcc: {
                type: 'string',
                description: 'BCC recipients (comma-separated email addresses). Optional.'
            }
        },
        required: ['to', 'subject', 'body']
    },

    // Main execution function
    execute: async args => {
        const { to, subject, body, cc, bcc } = args;

        // Log send attempt
        logger.debug(`Sending Gmail to ${to}: ${subject}`);

        try {
            // Get Gmail client
            const gmail = await getGmailClient();

            // Build email message in MIME format (always plain text)
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `To: ${to}`,
                cc ? `Cc: ${cc}` : '',
                bcc ? `Bcc: ${bcc}` : '',
                `Subject: ${utf8Subject}`,
                `MIME-Version: 1.0`,
                `Content-Type: text/plain; charset=utf-8`,
                '',
                body
            ];

            // Join message parts and encode in base64url format
            const message = messageParts.filter(p => p).join('\r\n');
            const encodedMessage = Buffer.from(message)
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
            return {
                success: true,
                output: `Email sent successfully. Message ID: ${response.data.id}`
            };
        } catch (error) {
            logger.error(`Gmail send error: ${error.message}`);
            return {
                success: false,
                output: '',
                error: `Gmail send failed: ${error.message}`
            };
        }
    }
};

// Gmail labels tool
export const gmailLabelsTool = {
    // Tool definition
    name: 'gmail_list_labels',
    description: 'List all Gmail labels/folders (Inbox, Sent, Drafts, custom labels). Returns label IDs and names.',
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

            // Return success with formatted results
            return {
                success: true,
                output: JSON.stringify(labels, null, 2)
            };
        } catch (error) {
            logger.error(`Gmail labels error: ${error.message}`);
            return {
                success: false,
                output: '',
                error: `Gmail labels list failed: ${error.message}`
            };
        }
    }
};