import { logger } from '../../../src/utils/common/logger.js';
import { getSlidesClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Slides delete slide tool
export const slidesDeleteSlideTool = {
    // Tool definition
    name: 'slides_delete_slide',
    description: 'Delete a slide from a Google Slides presentation by its slide ID.',
    parameters: {
        type: 'object',
        properties: {
            presentationId: {
                type: 'string',
                description: 'Presentation ID.'
            },
            slideId: {
                type: 'string',
                description: 'Slide object ID (from slides_get).'
            }
        },
        required: ['presentationId', 'slideId']
    },

    // Main execution function
    execute: async args => {
        const { presentationId, slideId } = args;

        // Log delete attempt
        logger.debug(`Deleting slide ${slideId} from presentation: ${presentationId}`);

        try {
            // Get Slides client
            const slides = await getSlidesClient();

            // Delete the slide object by ID
            await slides.presentations.batchUpdate({
                presentationId,
                requestBody: {
                    requests: [{
                        deleteObject: { objectId: slideId }
                    }]
                }
            });

            // Return success
            return handleToolResponse(`Slide deleted successfully.`);
        } catch (error) {
            return handleToolError({ error, message: 'Slides delete failed' });
        }
    }
};