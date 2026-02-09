import { logger } from '../../utils/logger.js';
import { getDriveClient } from '../../utils/google-client.js';

// Drive list files tool
export const driveListFilesTool = {
    // Tool definition
    name: 'drive_list_files',
    description: 'List Google Drive files.',
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
                fields: 'files(id, name, mimeType, size, modifiedTime, owners, shared, webViewLink)'
            });

            // Check if any files found
            if (!response.data.files || response.data.files.length === 0) {
                return {
                    success: true,
                    output: 'No files found matching the criteria.'
                };
            }

            // Format output
            const files = response.data.files.map(file => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size ? parseInt(file.size) : 0,
                modifiedTime: file.modifiedTime,
                shared: file.shared || false,
                owners: file.owners?.map(o => o.emailAddress) || [],
                webViewLink: file.webViewLink
            }));

            // Return the files
            return {
                success: true,
                output: files
            };
        } catch (error) {
            logger.error(`Drive list error: ${error.message}`);
            return {
                success: false,
                error: `Drive list failed: ${error.message}`
            };
        }
    }
};

// Drive read file tool
export const driveReadFileTool = {
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
            return {
                success: true,
                output: content
            };
        } catch (error) {
            logger.error(`Drive read error: ${error.message}`);
            return {
                success: false,
                error: `Drive read failed: ${error.message}`
            };
        }
    }
};

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
                        mimeType: 'text/plain',
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
            return {
                success: true,
                output: `File created successfully: ${response.data.name}\nID: ${response.data.id}\nLink: ${response.data.webViewLink}`
            };
        } catch (error) {
            logger.error(`Drive create error: ${error.message}`);
            return {
                success: false,
                error: `Drive create failed: ${error.message}`
            };
        }
    }
};

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
        const { fileId, name, content, addParentFolderId, removeParentFolderId } = args;

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
                    mimeType: 'text/plain',
                    body: content
                };
            }

            // Update the file
            const response = await drive.files.update(updateParams);

            // Return success with updated file info
            return {
                success: true,
                output: `File updated successfully: ${response.data.name}`
            };
        } catch (error) {
            logger.error(`Drive update error: ${error.message}`);
            return {
                success: false,
                error: `Drive update failed: ${error.message}`
            };
        }
    }
};

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
            return {
                success: true,
                output: 'File moved to trash successfully'
            };
        } catch (error) {
            logger.error(`Drive delete error: ${error.message}`);
            return {
                success: false,
                error: `Drive delete failed: ${error.message}`
            };
        }
    }
};

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
            return {
                success: true,
                output: `File shared successfully.\nView link: ${file.data.webViewLink}\nDownload link: ${file.data.webContentLink || 'N/A'}`
            };
        } catch (error) {
            logger.error(`Drive share error: ${error.message}`);
            return {
                success: false,
                error: `Drive share failed: ${error.message}`
            };
        }
    }
};