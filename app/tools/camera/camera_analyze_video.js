import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { analyzeVideoWithGoogleAi } from '../../../src/utils/google/google-ai.js';

// Camera video analysis tool
const cameraAnalyzeVideoTool = {
    // Tool definition
    name: 'camera_analyze_video',
    description: 'Analyze a local video file using AI video understanding capabilities by running a natural-language analysis prompt against it.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Absolute local path to the video file to analyze.'
            },
            prompt: {
                type: 'string',
                description: 'What to look for or analyze in the video (e.g. "Describe all activity in this footage. Are there any people or vehicles?").'
            }
        },
        required: ['filePath', 'prompt']
    },

    // Main execution function
    execute: async args => {
        const { filePath, prompt } = args;

        try {
            // Analyze the video with Google AI and return the results
            const result = await analyzeVideoWithGoogleAi({ filePath, prompt });

            // Return the analysis result to the agent
            return handleToolResponse(result);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to analyze video' });
        }
    }
};

// Export the tool as the default export of this module
export default cameraAnalyzeVideoTool;