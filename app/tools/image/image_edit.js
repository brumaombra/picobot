import { writeFile, mkdir } from 'fs/promises';
import { dirname, normalize, resolve } from 'path';
import { WORKSPACE_DIR } from '../../../src/config.js';
import { logger } from '../../../src/utils/common/logger.js';
import { editImageWithGoogleAi } from '../../../src/utils/google/google-ai.js';
import { getFileExtensionFromMimeType, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Edit image tool
const imageEditTool = {
    // Tool definition
    name: 'image_edit',
    description: 'Edit a local image using a text prompt and save it to the workspace.',
    parameters: {
        type: 'object',
        properties: {
            imagePath: {
                type: 'string',
                description: 'Path to the local source image to edit.'
            },
            prompt: {
                type: 'string',
                description: 'Instruction describing how the image should be edited.'
            }
        },
        required: ['imagePath', 'prompt']
    },

    // Main execution function
    execute: async args => {
        const { imagePath, prompt } = args;

        try {
            // Edit image with Google AI
            const edited = await editImageWithGoogleAi({ imagePath, prompt });
            const extension = getFileExtensionFromMimeType(edited.mimeType);

            // Save edited images under the workspace images folder
            const fullPath = normalize(resolve(WORKSPACE_DIR, 'images', `edited_${Date.now()}${extension}`));

            // Save edited image bytes to disk
            await mkdir(dirname(fullPath), { recursive: true });
            const imageBuffer = Buffer.from(edited.imageBase64, 'base64');
            await writeFile(fullPath, imageBuffer);

            // Log the saved image path
            logger.debug(`Artist: edited image saved to ${fullPath}`);

            // Return file path and metadata
            return handleToolResponse({
                filePath: fullPath,
                mimeType: edited.mimeType,
                bytes: imageBuffer.length
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to edit image' });
        }
    }
};

// Export the tool as the default export of this module
export default imageEditTool;