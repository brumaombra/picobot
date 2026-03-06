import { existsSync } from 'fs';
import { resolve } from 'path';
import { isSensitivePath, handleToolError, handleToolResponse } from '../../utils/utils.js';
import { sendOutbound } from '../../bus/message-bus.js';
import { logger } from '../../utils/logger.js';

// Send file tool - allows agent to send files and images to the user via Telegram
export const sendFileTool = {
    // Tool definition
    name: 'send_file',
    description: 'Send a file (image, document, etc.) to the user via Telegram.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Absolute path to the file or image to send.'
            },
            caption: {
                type: 'string',
                description: 'Optional caption/description for the file or image.'
            }
        },
        required: ['filePath']
    },

    // Main execution function
    execute: async ({ filePath, caption }, context) => {
        try {
            // Resolve the file path (handle both relative and absolute paths)
            const fullPath = resolve(context.workingDir, filePath);

            // Block sending sensitive files containing secrets
            if (!isSensitivePath({ fullPath, workDir: context.workingDir, action: 'read' })) {
                return handleToolError({ message: 'Access denied: This file is marked as sensitive.' });
            }

            // Check if file exists
            if (!existsSync(fullPath)) {
                return handleToolError({ message: `File not found: ${filePath}` });
            }

            // Send through the outbound message system
            sendOutbound({
                sessionKey: context.sessionKey,
                content: caption || `📎 Sending file: ${filePath}`,
                file: {
                    path: fullPath,
                    caption: caption || undefined
                }
            });

            // Log the action
            logger.debug(`Sending file: ${fullPath} to ${context.sessionKey}`);

            // Return success response
            return handleToolResponse(`File sent successfully: ${filePath}`);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to send file' });
        }
    }
};