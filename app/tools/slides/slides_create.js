import { logger } from '../../../squadforge/src/index.js';
import { getSlidesClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Slides create presentation tool
export default {
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