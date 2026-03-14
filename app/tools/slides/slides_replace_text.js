import { logger } from '../../../squadforge/src/index.js';
import { getSlidesClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Slides replace text tool
const slidesReplaceTextTool = {
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

// Export the tool as the default export of this module
export default slidesReplaceTextTool;