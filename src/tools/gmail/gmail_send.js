import { logger } from '../../utils/logger.js';
import { getGmailClient } from '../../utils/google-client.js';
import { decodeHtmlEntities, handleToolError, handleToolResponse } from '../../utils/utils.js';

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