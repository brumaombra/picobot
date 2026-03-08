import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { getConfigValue } from '../../config/config.js';
import { logger } from '../logger.js';
import { delay, getImageMimeTypeFromPath } from '../utils.js';

const AI_MODEL = 'gemini-3.1-flash-lite-preview'; // Model used
const POLL_INTERVAL_MS = 5000; // Check status every 5 seconds
const MAX_POLL_ATTEMPTS = 24; // Wait up to 2 minutes (24 attempts * 5 seconds)

// Check API key config and return it
const getGoogleAiApiKey = () => {
    // Read API key from config
    const apiKey = getConfigValue('googleAi.apiKey');
    if (!apiKey) {
        throw new Error('Google AI API key is not configured. Please add googleAi.apiKey to your config.');
    }

    // Return validated API key
    return apiKey;
};

// Upload a local video and wait until Google File API marks it ready
export const uploadVideoToGoogleAi = async ({ filePath, apiKey }) => {
    // Create a file manager instance for handling uploads to the Google File API
    const fileManager = new GoogleAIFileManager(apiKey);

    // Log the upload action
    logger.debug(`Camera: uploading video "${filePath}" to Google File API`);

    // Step 1: Upload the video file to the Google File API
    const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: 'video/mp4',
        displayName: filePath.split(/[\\/]/).pop()
    });

    // Get the uploaded file reference for polling and analysis
    let uploadedFile = uploadResult.file;
    logger.debug(`Camera: video uploaded as "${uploadedFile.name}", state: ${uploadedFile.state}`);

    // Step 2: Poll until the file is ACTIVE (Google processes it server-side)
    let pollAttempts = 0;
    while (uploadedFile.state === 'PROCESSING') {
        // Check for timeout
        if (pollAttempts >= MAX_POLL_ATTEMPTS) {
            throw new Error('Google File API timed out while processing the video.');
        }

        // Wait before polling again
        logger.debug(`Camera: waiting for video processing (attempt ${pollAttempts + 1}/${MAX_POLL_ATTEMPTS})...`);
        await delay(POLL_INTERVAL_MS);
        uploadedFile = await fileManager.getFile(uploadedFile.name);
        pollAttempts++;
    }

    // Check if the file is ready for analysis
    if (uploadedFile.state === 'FAILED') {
        throw new Error(`Google File API failed to process the video: ${uploadedFile.name}`);
    }

    // Return upload context for the analysis step
    return { fileManager, uploadedFile };
};

// Run Gemini analysis against an already-uploaded Google File API video
export const analyzeUploadedGoogleAiVideo = async ({ uploadedFile, prompt, apiKey }) => {
    // Log the successful processing
    logger.debug(`Camera: video is ACTIVE, running analysis with model "${AI_MODEL}"`);

    // Step 3: Run Gemini analysis with the uploaded file reference
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({ model: AI_MODEL });

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

    // Return model output payload
    return analysis;
};

// Best-effort cleanup for uploaded temporary file
const deleteUploadedGoogleAiFile = async ({ fileManager, uploadedFile }) => {
    // Skip cleanup if there is no uploaded file reference
    if (!uploadedFile?.name) {
        return;
    }

    try {
        await fileManager.deleteFile(uploadedFile.name); // Delete the uploaded file from Google File API
        logger.debug(`Camera: deleted uploaded file "${uploadedFile.name}" from Google File API`);
    } catch (cleanupError) {
        logger.warn(`Camera: failed to delete uploaded file "${uploadedFile.name}": ${cleanupError.message}`);
    }
};

// Analyze a local video file with Google AI and return the model output
export const analyzeVideoWithGoogleAi = async ({ filePath, prompt }) => {
    // Validate API key before starting any remote operation
    const apiKey = getGoogleAiApiKey();

    // Keep references for cleanup in the finally block
    let fileManager = null;
    let uploadedFile = null;

    try {
        // Upload and wait for Google processing to complete
        const upload = await uploadVideoToGoogleAi({ filePath, apiKey });
        fileManager = upload.fileManager;
        uploadedFile = upload.uploadedFile;

        // Analyze the processed uploaded file with Gemini
        const analysis = await analyzeUploadedGoogleAiVideo({ uploadedFile, prompt, apiKey });

        // Return analysis plus local source file path
        return {
            analysis,
            filePath
        };
    } finally {
        await deleteUploadedGoogleAiFile({ fileManager, uploadedFile }); // Always attempt to clean up remote uploaded file
    }
};

// Analyze a local image file with Google AI and return the model output
export const analyzeImageWithGoogleAi = async ({ filePath, prompt }) => {
    // Validate API key before starting any remote operation
    const apiKey = getGoogleAiApiKey();

    // Read the image file and infer its MIME type
    const imageBytes = await readFile(filePath);
    const mimeType = getImageMimeTypeFromPath(filePath);

    // Create the Google Generative AI client
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({ model: AI_MODEL });

    // Run the analysis prompt against the image file (base64-encoded inline data)
    const result = await gemini.generateContent([{
        inlineData: {
            mimeType,
            data: imageBytes.toString('base64')
        }
    }, {
        text: prompt
    }]);

    // Extract the analysis text from the response
    const analysis = result.response.text();
    logger.debug(`Camera: image analysis complete (${analysis.length} chars)`);

    // Return model output payload
    return {
        analysis,
        filePath
    };
};
