import { logger } from '../../utils/logger.js';
import { getDriveClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Drive create file tool
export const driveCreateFileTool = {
    // Tool definition
    name: 'drive_create_file',
    description: 'Create Google Drive file.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'File name.'
            },
            content: {
                type: 'string',
                description: 'File content.'
            },
            mimeType: {
                type: 'string',
                description: 'MIME type.'
            },
            parentFolderId: {
                type: 'string',
                description: 'Parent folder ID.'
            }
        },
        required: ['name']
    },

    // Main execution function
    execute: async args => {
        const { name, content, mimeType = 'text/plain', parentFolderId } = args;

        // Log create attempt
        logger.debug(`Creating Drive file: ${name}`);

        try {
            // Get Drive client
            const drive = await getDriveClient();

            // Build file metadata
            const fileMetadata = {
                name,
                mimeType,
                parents: parentFolderId ? [parentFolderId] : undefined
            };

            // Create file with or without content
            let response;
            if (content) {
                // Create file with content
                response = await drive.files.create({
                    requestBody: fileMetadata,
                    media: {
                        mimeType,
                        body: content
                    },
                    fields: 'id, name, webViewLink'
                });
            } else {
                // Create empty file or folder
                response = await drive.files.create({
                    requestBody: fileMetadata,
                    fields: 'id, name, webViewLink'
                });
            }

            // Return success with created file info
            return handleToolResponse(`File created successfully: ${response.data.name}\nID: ${response.data.id}\nLink: ${response.data.webViewLink}`);
        } catch (error) {
            return handleToolError({ error, message: 'Drive create failed' });
        }
    }
};