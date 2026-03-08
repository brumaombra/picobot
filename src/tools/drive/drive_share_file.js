import { logger } from '../../utils/logger.js';
import { getDriveClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// Drive share file tool
export const driveShareFileTool = {
    // Tool definition
    name: 'drive_share_file',
    description: 'Share Google Drive file.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File ID.'
            },
            email: {
                type: 'string',
                description: 'Email address.'
            },
            role: {
                type: 'string',
                enum: ['reader', 'commenter', 'writer'],
                description: 'Permission role.'
            },
            type: {
                type: 'string',
                enum: ['user', 'anyone'],
                description: 'Permission type.'
            }
        },
        required: ['fileId']
    },

    // Main execution function
    execute: async args => {
        const { fileId, email, role = 'reader', type } = args;

        // Log share attempt
        logger.debug(`Sharing Drive file: ${fileId}`);

        try {
            // Get Drive client
            const drive = await getDriveClient();

            // Build permission object
            const permission = {
                role,
                type: type || (email ? 'user' : 'anyone')
            };

            // Add email to permission if sharing with specific user
            if (email) {
                permission.emailAddress = email;
            }

            // Create permission
            await drive.permissions.create({
                fileId,
                requestBody: permission,
                sendNotificationEmail: !!email
            });

            // Get file link
            const file = await drive.files.get({
                fileId,
                fields: 'webViewLink, webContentLink'
            });

            // Return success with file links
            return handleToolResponse(`File shared successfully.\nView link: ${file.data.webViewLink}\nDownload link: ${file.data.webContentLink || 'N/A'}`);
        } catch (error) {
            return handleToolError({ error, message: 'Drive share failed' });
        }
    }
};