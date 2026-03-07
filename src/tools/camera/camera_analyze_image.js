import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { analyzeImageWithGoogleAi } from '../../utils/google-ai.js';

// Camera image analysis tool
export const cameraAnalyzeImageTool = {
    // Tool definition
    name: 'camera_analyze_image',
    description: 'Analyze a local image file using AI image understanding capabilities by running a natural-language analysis prompt against it.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Absolute local path to the image file to analyze.'
            },
            prompt: {
                type: 'string',
                description: 'What to look for or analyze in the image (e.g. "Describe this scene and list any people, vehicles, or suspicious activity.").'
            }
        },
        required: ['filePath', 'prompt']
    },

    // Main execution function
    execute: async args => {
        const { filePath, prompt } = args;

        try {
            // Analyze the image with Google AI and return the results
            const result = await analyzeImageWithGoogleAi({ filePath, prompt });

            // Return the analysis result to the agent
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to analyze image' });
        }
    }
};