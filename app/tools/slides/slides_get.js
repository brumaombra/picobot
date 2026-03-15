import { logger } from '../../../squadforge/src/index.js';
import { getSlidesClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Slides get presentation tool
export default {
    // Tool definition
    name: 'slides_get',
    description: 'Get a Google Slides presentation structure with all slides and their text content.',
    parameters: {
        type: 'object',
        properties: {
            presentationId: {
                type: 'string',
                description: 'Presentation ID.'
            }
        },
        required: ['presentationId']
    },

    // Main execution function
    execute: async args => {
        const { presentationId } = args;

        // Log get attempt
        logger.debug(`Getting Slides presentation: ${presentationId}`);

        try {
            // Get Slides client
            const slides = await getSlidesClient();

            // Fetch full presentation
            const response = await slides.presentations.get({ presentationId });
            const presentation = response.data;

            // Extract per-slide text content and shape metadata
            const slideData = presentation.slides?.map((slide, index) => {
                const elements = [];

                // Walk all page elements looking for text shapes
                slide.pageElements?.forEach(element => {
                    if (element.shape?.text) {
                        // Concatenate all text runs into a single string
                        const text = element.shape.text.textElements
                            ?.filter(text => text.textRun)
                            .map(text => text.textRun.content)
                            .join('') || '';

                        // Include element ID so the agent can reference it in updates
                        if (text.trim()) {
                            elements.push({
                                elementId: element.objectId,
                                placeholderType: element.shape?.placeholder?.type || null,
                                text: text.trim()
                            });
                        }
                    }
                });

                // Return slide summary with text elements
                return {
                    index: index + 1,
                    slideId: slide.objectId,
                    elements
                };
            }) || [];

            // Return presentation summary
            return handleToolResponse({
                presentationId: presentation.presentationId,
                title: presentation.title,
                slideCount: slideData.length,
                webViewLink: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
                slides: slideData
            });
        } catch (error) {
            return handleToolError({ error, message: 'Slides get failed' });
        }
    }
};