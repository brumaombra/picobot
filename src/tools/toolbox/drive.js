import { logger } from '../../utils/logger.js';
import { getDriveClient } from '../../utils/google-client.js';

// Drive list files tool
export const driveListFilesTool = {
    // Tool definition
    name: 'drive_list_files',
    description: 'List files and folders in Google Drive. Supports search queries, filtering by type, parent folder, starred status. Returns file ID, name, type, size, modified date, and permissions.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query (e.g., "name contains \'report\'", "mimeType=\'application/pdf\'", "\'parentFolderId\' in parents"). Use Drive API query syntax. Optional.'
            },
            folderId: {
                type: 'string',
                description: 'List files in specific folder (use folder ID). Default: root folder. Optional.'
            },
            maxResults: {
                type: 'number',
                description: 'Maximum number of results (default: 10, max: 100). Optional.'
            },
            orderBy: {
                type: 'string',
                description: 'Sort order (e.g., "name", "modifiedTime desc", "createdTime"). Default: "name". Optional.'
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

            // Return files as JSON string
            return {
                success: true,
                output: JSON.stringify(files, null, 2)
            };
        } catch (error) {
            logger.error(`Drive list error: ${error.message}`);
            return {
                success: false,
                output: '',
                error: `Drive list failed: ${error.message}`
            };
        }
    }
};

// Drive read file tool
export const driveReadFileTool = {
    // Tool definition
    name: 'drive_read_file',
    description: 'Read/download content of a Google Drive file by ID. Returns file content as text for text-based files (docs, txt, csv, etc.). For Google Docs/Sheets/Slides, exports to requested format.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File ID to read (obtained from drive_list_files).'
            },
            mimeType: {
                type: 'string',
                description: 'Export MIME type for Google Workspace files (e.g., "text/plain" for Docs, "text/csv" for Sheets). Optional.'
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
                output: '',
                error: `Drive read failed: ${error.message}`
            };
        }
    }
};

// Drive create file tool
export const driveCreateFileTool = {
    // Tool definition
    name: 'drive_create_file',
    description: 'Create or upload file to Google Drive. Can create text files, Google Docs, folders, or upload content. Returns created file ID.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'File or folder name (e.g., "report.txt", "My Folder").'
            },
            content: {
                type: 'string',
                description: 'File content (text). Required for file creation, omit for folders.'
            },
            mimeType: {
                type: 'string',
                description: 'MIME type (e.g., "text/plain", "application/vnd.google-apps.document" for Google Doc, "application/vnd.google-apps.folder" for folder). Default: "text/plain".'
            },
            parentFolderId: {
                type: 'string',
                description: 'Parent folder ID. Default: root folder. Optional.'
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
                output: '',
                error: `Drive create failed: ${error.message}`
            };
        }
    }
};

// Drive update file tool
export const driveUpdateFileTool = {
    // Tool definition
    name: 'drive_update_file',
    description: 'Update existing Google Drive file content or metadata. Can change file name, content, or move to different folder.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File ID to update (obtained from drive_list_files).'
            },
            name: {
                type: 'string',
                description: 'New file name. Optional.'
            },
            content: {
                type: 'string',
                description: 'New file content (text). Optional.'
            },
            addParentFolderId: {
                type: 'string',
                description: 'Folder ID to move file into. Optional.'
            },
            removeParentFolderId: {
                type: 'string',
                description: 'Folder ID to remove file from. Optional.'
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
                output: '',
                error: `Drive update failed: ${error.message}`
            };
        }
    }
};

// Drive delete file tool
export const driveDeleteFileTool = {
    // Tool definition
    name: 'drive_delete_file',
    description: 'Delete file or folder from Google Drive by ID. Moves to trash (can be restored). Use permanently delete option with caution.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File or folder ID to delete (obtained from drive_list_files).'
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
                output: '',
                error: `Drive delete failed: ${error.message}`
            };
        }
    }
};

// Drive share file tool
export const driveShareFileTool = {
    // Tool definition
    name: 'drive_share_file',
    description: 'Share Google Drive file with users or make public. Can set permissions (viewer, commenter, editor) for specific emails or create public link.',
    parameters: {
        type: 'object',
        properties: {
            fileId: {
                type: 'string',
                description: 'File ID to share (obtained from drive_list_files).'
            },
            email: {
                type: 'string',
                description: 'Email address to share with. Omit for public link.'
            },
            role: {
                type: 'string',
                description: 'Permission role: "reader" (view only), "commenter" (can comment), "writer" (can edit). Default: "reader".'
            },
            type: {
                type: 'string',
                description: 'Permission type: "user" (specific email), "anyone" (public link). Default: "user" if email provided, "anyone" otherwise.'
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
                output: '',
                error: `Drive share failed: ${error.message}`
            };
        }
    }
};