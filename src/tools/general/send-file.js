import { existsSync } from 'fs';
import { resolve } from 'path';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { sendOutbound } from '../../bus/message-bus.js';
import { logger } from '../../utils/logger.js';

// Send file tool - allows agent to send files to the user via Telegram
export const sendFileTool = {
    // Tool definition
    name: 'send_file',
    description: 'Send a file to the user via Telegram. The file must exist in the workspace.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Path to the file to send (relative to workspace or absolute)'
            },
            caption: {
                type: 'string',
                description: 'Optional caption/description for the file'
            }
        },
        required: ['filePath']
    },

    // Main execution function
    execute: async ({ filePath, caption }, context) => {
        try {
            // Resolve the file path (handle both relative and absolute paths)
            const fullPath = resolve(context.workingDir, filePath);

            // Check if file exists
            if (!existsSync(fullPath)) {
                return handleToolError({ message: `File not found: ${filePath}` });
            }

            // Send the file through the outbound message system
            sendOutbound({
                sessionKey: context.sessionKey,
                content: caption || `📎 Sending file: ${filePath}`,
                file: {
                    path: fullPath,
                    caption: caption || undefined
                }
            });

            // Log the file sending action
            logger.debug(`Sending file: ${fullPath} to ${context.sessionKey}`);

            // Return success response
            return handleToolResponse(`File sent successfully: ${filePath}`);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to send file' });
        }
    }
};