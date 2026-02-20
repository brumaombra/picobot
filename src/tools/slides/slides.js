import { logger } from '../../utils/logger.js';
import { getSlidesClient } from '../../utils/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

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

// Slides get presentation tool
export const slidesGetTool = {
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

// Slides add slide tool
export const slidesAddSlideTool = {
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

// Slides replace text tool
export const slidesReplaceTextTool = {
    // Tool definition
    name: 'slides_replace_text',
    description: 'Find and replace text across an entire Google Slides presentation.',
    parameters: {
        type: 'object',
        properties: {
            presentationId: {
                type: 'string',
                description: 'Presentation ID.'
            },
            oldText: {
                type: 'string',
                description: 'Text to find.'
            },
            newText: {
                type: 'string',
                description: 'Replacement text.'
            },
            matchCase: {
                type: 'boolean',
                description: 'Case-sensitive match (default: false).'
            }
        },
        required: ['presentationId', 'oldText', 'newText']
    },

    // Main execution function
    execute: async args => {
        const { presentationId, oldText, newText, matchCase = false } = args;

        // Log replace attempt
        logger.debug(`Replacing text in presentation: ${presentationId}`);

        try {
            // Get Slides client
            const slides = await getSlidesClient();

            // Execute replaceAllText — no element IDs required
            const response = await slides.presentations.batchUpdate({
                presentationId,
                requestBody: {
                    requests: [{
                        replaceAllText: {
                            containsText: { text: oldText, matchCase },
                            replaceText: newText
                        }
                    }]
                }
            });

            // Report how many occurrences were replaced
            const occurrences = response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
            return handleToolResponse(`Replaced ${occurrences} occurrence(s) of "${oldText}" with "${newText}".`);
        } catch (error) {
            return handleToolError({ error, message: 'Slides replace text failed' });
        }
    }
};

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