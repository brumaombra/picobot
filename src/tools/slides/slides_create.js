import { logger } from '../../utils/common/logger.js';
import { getSlidesClient } from '../../utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Slides create presentation tool
export const slidesCreateTool = {
    // Tool definition
    name: 'slides_create',
    description: 'Create a new Google Slides presentation.',
    parameters: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Presentation title.'
            }
        },
        required: ['title']
    },

    // Main execution function
    execute: async args => {
        const { title } = args;

        // Log create attempt
        logger.debug(`Creating Slides presentation: ${title}`);

        try {
            // Get Slides client
            const slides = await getSlidesClient();

            // Create the presentation
            const response = await slides.presentations.create({
                requestBody: { title }
            });

            // Return presentation metadata
            const presentation = response.data;
            return handleToolResponse({
                presentationId: presentation.presentationId,
                title: presentation.title,
                webViewLink: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`
            });
        } catch (error) {
            return handleToolError({ error, message: 'Slides create failed' });
        }
    }
};