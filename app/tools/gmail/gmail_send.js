import { readFile } from 'fs/promises';
import { basename, isAbsolute } from 'path';
import { logger } from '../../../squadforge/src/index.js';
import { getGmailClient } from '../../../src/utils/google/google-client.js';
import { chunkBase64, decodeHtmlEntities, getMimeTypeFromFileName, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Gmail send tool
const gmailSendTool = {
    // Tool definition
    name: 'gmail_send',
    description: 'Send email via Gmail.',
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
            },
            attachments: {
                type: 'array',
                description: 'Optional local absolute file attachment paths.',
                items: {
                    type: 'string',
                    description: 'Local absolute file path to attach.'
                }
            }
        },
        required: ['to', 'subject', 'body']
    },

    // Main execution function
    execute: async args => {
        const { to, subject, body, html = false, cc, bcc, attachments = [] } = args;

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

            // Create the raw email message with attachments if provided
            const rawMessage = await createEmailBody({
                to,
                subject,
                safeBody,
                html,
                cc,
                bcc,
                attachments
            });

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
            return handleToolResponse({
                message: 'Email sent successfully',
                messageId: response.data.id,
                attachmentsSent: attachments.length
            });
        } catch (error) {
            return handleToolError({ error, message: 'Gmail send failed' });
        }
    }
};

// Build a raw MIME email message body (single-part or multipart with attachments)
const createEmailBody = async ({ to, subject, safeBody, html, cc, bcc, attachments }) => {
    // Build multipart MIME when attachments are included
    if (attachments.length > 0) {
        // Generate a unique boundary string for separating parts
        const boundary = `picobot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        // Build the email headers and the first part with the email body
        const headers = [
            `From: me`,
            `To: ${to}`,
            cc ? `Cc: ${cc}` : null,
            bcc ? `Bcc: ${bcc}` : null,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/mixed; boundary="${boundary}"`
        ].filter(Boolean);

        // Start with the email body as the first part
        const parts = [
            `--${boundary}`,
            `Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=UTF-8`,
            `Content-Transfer-Encoding: 7bit`,
            '',
            safeBody
        ];

        // Process each attachment and add as a new part
        for (const attachmentPath of attachments) {
            // Validate attachment path
            const filePath = String(attachmentPath || '').trim();
            if (!filePath) {
                throw new Error('All attachments must be non-empty file paths.');
            }

            // Ensure the file path is absolute to prevent accidental access to unintended files
            if (!isAbsolute(filePath)) {
                throw new Error(`Attachment path must be absolute: ${filePath}`);
            }

            // Read the file, determine its MIME type, and encode it in base64 for inclusion
            const fileBuffer = await readFile(filePath);
            const fileName = String(basename(filePath)).replace(/"/g, '');
            const mimeType = getMimeTypeFromFileName(fileName);
            const base64Data = chunkBase64(fileBuffer.toString('base64'));

            // Add the attachment part with appropriate headers for Gmail to recognize it
            parts.push(
                `--${boundary}`,
                `Content-Type: ${mimeType}; name="${fileName}"`,
                `Content-Disposition: attachment; filename="${fileName}"`,
                `Content-Transfer-Encoding: base64`,
                '',
                base64Data
            );
        }

        // End the multipart message with the closing boundary
        parts.push(`--${boundary}--`, '');

        // Return the full raw email message with headers and multipart body
        return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
    } else {
        // Build single-part message when no attachments are provided
        const headers = [
            `From: me`,
            `To: ${to}`,
            cc ? `Cc: ${cc}` : null,
            bcc ? `Bcc: ${bcc}` : null,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=UTF-8`
        ].filter(Boolean);

        // Return headers plus body for simple email
        return headers.join('\r\n') + '\r\n\r\n' + safeBody;
    }
};

// Export the tool as the default export of this module
export default gmailSendTool;