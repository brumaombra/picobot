import { logger } from '../../../squadforge/src/index.js';
import { getSlidesClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Slides add slide tool
const slidesAddSlideTool = {
    // Tool definition
    name: 'slides_add_slide',
    description: 'Add a new slide to a Google Slides presentation with optional title and body text.',
    parameters: {
        type: 'object',
        properties: {
            presentationId: {
                type: 'string',
                description: 'Presentation ID.'
            },
            title: {
                type: 'string',
                description: 'Slide title.'
            },
            body: {
                type: 'string',
                description: 'Slide body text.'
            },
            insertionIndex: {
                type: 'number',
                description: 'Zero-based position to insert the slide. Appends at the end if omitted.'
            }
        },
        required: ['presentationId']
    },

    // Main execution function
    execute: async args => {
        const { presentationId, title, body, insertionIndex } = args;

        // Log add attempt
        logger.debug(`Adding slide to presentation: ${presentationId}`);

        try {
            // Get Slides client
            const slides = await getSlidesClient();

            // Generate a stable object ID for the new slide so we can find it after creation
            const slideId = `slide_${Date.now()}`;

            // Create the slide with the appropriate layout
            await slides.presentations.batchUpdate({
                presentationId,
                requestBody: {
                    requests: [{
                        createSlide: {
                            objectId: slideId,
                            ...(insertionIndex !== undefined ? { insertionIndex } : {}),
                            slideLayoutReference: {
                                predefinedLayout: title ? 'TITLE_AND_BODY' : 'BLANK'
                            }
                        }
                    }]
                }
            });

            // Fetch back the slide to discover placeholder shape IDs
            const updated = await slides.presentations.get({ presentationId });
            const newSlide = updated.data.slides?.find(s => s.objectId === slideId);

            // Insert text into title and body placeholders if provided
            if (newSlide && (title || body)) {
                const textRequests = [];

                // Walk page elements to find placeholders
                newSlide.pageElements?.forEach(element => {
                    const type = element.shape?.placeholder?.type;

                    // Match title placeholder and insert title text
                    if ((type === 'TITLE' || type === 'CENTER_TITLE') && title) {
                        textRequests.push({
                            insertText: {
                                objectId: element.objectId,
                                insertionIndex: 0,
                                text: title
                            }
                        });
                    }

                    // Match body placeholder and insert body text
                    if ((type === 'BODY' || type === 'SUBTITLE') && body) {
                        textRequests.push({
                            insertText: {
                                objectId: element.objectId,
                                insertionIndex: 0,
                                text: body
                            }
                        });
                    }
                });

                // Execute text insertion batch
                if (textRequests.length > 0) {
                    await slides.presentations.batchUpdate({
                        presentationId,
                        requestBody: { requests: textRequests }
                    });
                }
            }

            // Return the new slide's ID and content summary
            return handleToolResponse({
                slideId,
                title: title || null,
                body: body || null
            });
        } catch (error) {
            return handleToolError({ error, message: 'Slides add slide failed' });
        }
    }
};

// Export the tool as the default export of this module
export default slidesAddSlideTool;