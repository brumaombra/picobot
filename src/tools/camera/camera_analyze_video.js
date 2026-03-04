import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { getConfigValue } from '../../config/config.js';

const VIDEO_MODEL = 'gemini-2.0-flash'; // Model used
const POLL_INTERVAL_MS = 5000; // Check status every 5 seconds
const MAX_POLL_ATTEMPTS = 24; // Wait up to 2 minutes (24 attempts * 5 seconds)

// Camera video analysis tool
export const cameraAnalyzeVideoTool = {
    // Tool definition
    name: 'camera_analyze_video',
    description: 'Analyze a local video file using Gemini\'s video understanding capabilities. Upload the video to the Google File API, wait for processing, then run a natural-language analysis prompt against it. Use camera_download_recording first to get the local file.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Absolute local path to the video file to analyze (e.g. as returned by camera_download_recording).'
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

        // Validate Google AI API key
        const apiKey = getConfigValue('googleAi.apiKey');
        if (!apiKey) {
            return handleToolError({ message: 'Google AI API key is not configured. Please add googleAi.apiKey to your config.' });
        }

        // Log the action
        logger.debug(`Camera: uploading video "${filePath}" to Google File API`);

        // Create a file manager instance for handling uploads to the Google File API
        const fileManager = new GoogleAIFileManager(apiKey);
        let uploadedFile = null;

        try {
            // Step 1: Upload the video file to the Google File API
            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType: 'video/mp4',
                displayName: filePath.split(/[\\/]/).pop()
            });

            // Get the uploaded file reference for polling and analysis
            uploadedFile = uploadResult.file;
            logger.debug(`Camera: video uploaded as "${uploadedFile.name}", state: ${uploadedFile.state}`);

            // Step 2: Poll until the file is ACTIVE (Google processes it server-side)
            let pollAttempts = 0;
            while (uploadedFile.state === 'PROCESSING') {
                // Check for timeout
                if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                    return handleToolError({ message: 'Google File API timed out while processing the video.' });
                }

                // Wait before polling again
                logger.debug(`Camera: waiting for video processing (attempt ${pollAttempts + 1}/${MAX_POLL_ATTEMPTS})...`);
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
                uploadedFile = await fileManager.getFile(uploadedFile.name);
                pollAttempts++;
            }

            // Check if the file is ready for analysis
            if (uploadedFile.state === 'FAILED') {
                return handleToolError({ message: `Google File API failed to process the video: ${uploadedFile.name}` });
            }

            // Log the successful processing
            logger.debug(`Camera: video is ACTIVE, running analysis with model "${VIDEO_MODEL}"`);

            // Step 3: Run Gemini analysis with the file reference
            const genAI = new GoogleGenerativeAI(apiKey);
            const gemini = genAI.getGenerativeModel({ model: VIDEO_MODEL });

            // Run the analysis prompt against the uploaded video file
            const result = await gemini.generateContent([{
                fileData: {
                    mimeType: uploadedFile.mimeType,
                    fileUri: uploadedFile.uri
                }
            }, {
                text: prompt
            }]);

            // Extract the analysis text from the response
            const analysis = result.response.text();
            logger.debug(`Camera: video analysis complete (${analysis.length} chars)`);

            // Return the analysis result
            return handleToolResponse({ analysis, model: VIDEO_MODEL, filePath });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to analyze video' });
        } finally {
            // Clean up: delete the uploaded file from Google's servers
            if (uploadedFile?.name) {
                try {
                    await fileManager.deleteFile(uploadedFile.name);
                    logger.debug(`Camera: deleted uploaded file "${uploadedFile.name}" from Google File API`);
                } catch (cleanupError) {
                    logger.warn(`Camera: failed to delete uploaded file "${uploadedFile.name}": ${cleanupError.message}`);
                }
            }
        }
    }
};