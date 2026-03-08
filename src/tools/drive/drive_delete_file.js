import { logger } from '../../utils/logger.js';
import { getDriveClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Drive delete file tool
export const driveDeleteFileTool = {
    // Tool definition
    name: 'drive_delete_file',
    description: 'Delete Google Drive file.',
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

        // Log delete attempt
        logger.debug(`Deleting Drive file: ${fileId}`);

        try {
            // Get Drive client
            const drive = await getDriveClient();

            // Delete the file (moves to trash)
            await drive.files.delete({
                fileId
            });

            // Return success with deleted file ID
            return handleToolResponse('File moved to trash successfully');
        } catch (error) {
            return handleToolError({ error, message: 'Drive delete failed' });
        }
    }
};