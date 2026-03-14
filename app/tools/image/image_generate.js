import { writeFile, mkdir } from 'fs/promises';
import { dirname, normalize, resolve } from 'path';
import { WORKSPACE_DIR } from '../../../src/config.js';
import { logger } from '../../../squadforge/src/index.js';
import { generateImageWithGoogleAi } from '../../../src/utils/google/google-ai.js';
import { getFileExtensionFromMimeType, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Generate image tool
const imageGenerateTool = {
    // Tool definition
    name: 'image_generate',
    description: 'Generate an image from a text prompt and save it to the workspace. Returns the file path and metadata of the generated image.',
    parameters: {
        type: 'object',
        properties: {
            prompt: {
                type: 'string',
                description: 'Text prompt describing the image to generate.'
            }
        },
        required: ['prompt']
    },

    // Main execution function
    execute: async args => {
        const { prompt } = args;

        try {
            // Generate image with Google AI
            const generated = await generateImageWithGoogleAi({ prompt });
            const extension = getFileExtensionFromMimeType(generated.mimeType);

            // Always save generated images under the workspace images folder
            const fullPath = normalize(resolve(WORKSPACE_DIR, 'images', `generated_${Date.now()}${extension}`));

            // Save generated image bytes to disk
            await mkdir(dirname(fullPath), { recursive: true });
            const imageBuffer = Buffer.from(generated.imageBase64, 'base64');
            await writeFile(fullPath, imageBuffer);

            // Log the saved image path
            logger.debug(`Artist: generated image saved to ${fullPath}`);

            // Return the file path and metadata for the agent to use
            return handleToolResponse({
                filePath: fullPath,
                mimeType: generated.mimeType,
                bytes: imageBuffer.length
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to generate image' });
        }
    }
};

// Export the tool as the default export of this module
export default imageGenerateTool;