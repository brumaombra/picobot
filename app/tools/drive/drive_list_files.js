import { logger } from '../../../src/utils/common/logger.js';
import { getDriveClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Drive list files tool
const driveListFilesTool = {
    // Tool definition
    name: 'drive_list_files',
    description: 'List Google Drive files with essential metadata. Use drive_get_file to get full details.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query.'
            },
            folderId: {
                type: 'string',
                description: 'Folder ID.'
            },
            maxResults: {
                type: 'number',
                description: 'Max results.'
            },
            orderBy: {
                type: 'string',
                description: 'Sort order.'
            }
        }
    },

    // Main execution function
    execute: async args => {
        const { query, folderId, maxResults = 10, orderBy = 'name' } = args;

        // Log list attempt
        logger.debug(`Listing Drive files: ${query || 'all'}`);

        try {
            // Get Drive client
            const drive = await getDriveClient();

            // Build query
            let q = query || '';
            if (folderId) {
                q = q ? `${q} and '${folderId}' in parents` : `'${folderId}' in parents`;
            }

            // List files
            const response = await drive.files.list({
                q,
                pageSize: Math.min(maxResults, 100),
                orderBy,
                fields: 'files(id, name, mimeType, modifiedTime)'
            });

            // Check if any files found
            if (!response.data.files || response.data.files.length === 0) {
                return handleToolResponse('No files found matching the criteria.');
            }

            // Format output with essential metadata only
            const files = response.data.files.map(file => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                modifiedTime: file.modifiedTime
            }));

            // Return the files
            return handleToolResponse(files);
        } catch (error) {
            return handleToolError({ error, message: 'Drive list failed' });
        }
    }
};

// Export the tool as the default export of this module
export default driveListFilesTool;