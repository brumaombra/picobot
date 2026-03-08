import { logger } from '../../utils/common/logger.js';
import { getDriveClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Drive get file tool
export const driveGetFileTool = {
    // Tool definition
    name: 'drive_get_file',
    description: 'Get detailed metadata about a specific Google Drive file by ID.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File ID.'
            }
        },
        required: ['fileId']
    },

    // Main execution function
    execute: async args => {
        const { fileId } = args;

        // Log get attempt
        logger.debug(`Getting Drive file metadata: ${fileId}`);

        try {
            // Get Drive client
            const drive = await getDriveClient();

            // Get file metadata
            const response = await drive.files.get({
                fileId,
                fields: 'id, name, mimeType, size, modifiedTime, createdTime, owners, shared, webViewLink, description, starred, trashed'
            });

            // Get the file metadata from response
            const file = response.data;

            // Return full file metadata
            return handleToolResponse({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size ? parseInt(file.size) : 0,
                modifiedTime: file.modifiedTime,
                createdTime: file.createdTime,
                shared: file.shared || false,
                owners: file.owners?.map(owner => owner.emailAddress) || [],
                webViewLink: file.webViewLink,
                description: file.description || '',
                starred: file.starred || false,
                trashed: file.trashed || false
            });
        } catch (error) {
            return handleToolError({ error, message: 'Drive get file failed' });
        }
    }
};