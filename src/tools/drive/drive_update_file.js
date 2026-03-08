import { logger } from '../../utils/logger.js';
import { getDriveClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// Drive update file tool
export const driveUpdateFileTool = {
    // Tool definition
    name: 'drive_update_file',
    description: 'Update Google Drive file.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File ID.'
            },
            name: {
                type: 'string',
                description: 'New name.'
            },
            content: {
                type: 'string',
                description: 'New content.'
            },
            mimeType: {
                type: 'string',
                description: 'MIME type for content.'
            },
            addParentFolderId: {
                type: 'string',
                description: 'Add to folder.'
            },
            removeParentFolderId: {
                type: 'string',
                description: 'Remove from folder.'
            }
        },
        required: ['fileId']
    },

    // Main execution function
    execute: async args => {
        const { fileId, name, content, mimeType = 'text/plain', addParentFolderId, removeParentFolderId } = args;

        // Log update attempt
        logger.debug(`Updating Drive file: ${fileId}`);

        try {
            // Get Drive client
            const drive = await getDriveClient();

            // Build update parameters
            const fileMetadata = {};
            if (name) fileMetadata.name = name;

            const updateParams = {
                fileId,
                requestBody: fileMetadata,
                addParents: addParentFolderId,
                removeParents: removeParentFolderId,
                fields: 'id, name, webViewLink'
            };

            // Add media if content provided
            if (content) {
                updateParams.media = {
                    mimeType,
                    body: content
                };
            }

            // Update the file
            const response = await drive.files.update(updateParams);

            // Return success with updated file info
            return handleToolResponse(`File updated successfully: ${response.data.name}`);
        } catch (error) {
            return handleToolError({ error, message: 'Drive update failed' });
        }
    }
};