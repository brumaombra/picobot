import { logger } from '../../../squadforge/src/index.js';
import { getDriveClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Drive read file tool
const driveReadFileTool = {
    // Tool definition
    name: 'drive_read_file',
    description: 'Read Google Drive file content.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File ID.'
            },
            mimeType: {
                type: 'string',
                description: 'Export MIME type.'
            }
        },
        required: ['fileId']
    },

    // Main execution function
    execute: async args => {
        const { fileId, mimeType } = args;

        // Log read attempt
        logger.debug(`Reading Drive file: ${fileId}`);

        try {
            // Get Drive client
            const drive = await getDriveClient();

            // Get file metadata to check mime type
            const fileMetadata = await drive.files.get({
                fileId,
                fields: 'mimeType, name'
            });

            let content;
            const fileMimeType = fileMetadata.data.mimeType;

            // Check if it's a Google Workspace file (needs export)
            if (fileMimeType.startsWith('application/vnd.google-apps')) {
                // Export Google Workspace file
                const exportMimeType = mimeType || 'text/plain';
                const response = await drive.files.export({
                    fileId,
                    mimeType: exportMimeType
                }, { responseType: 'text' });
                content = response.data;
            } else {
                // Download regular file
                const response = await drive.files.get({
                    fileId,
                    alt: 'media'
                }, { responseType: 'text' });
                content = response.data;
            }

            // Return file content
            return handleToolResponse(content);
        } catch (error) {
            return handleToolError({ error, message: 'Drive read failed' });
        }
    }
};

// Export the tool as the default export of this module
export default driveReadFileTool;