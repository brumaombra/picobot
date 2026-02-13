import { logger } from '../../utils/logger.js';
import { extractTextFromHtml, handleToolError, handleToolResponse } from '../../utils/utils.js';
import { WEB_MAX_CONTENT_LENGTH, WEB_FETCH_TIMEOUT_MS, WEB_USER_AGENT, WEB_ACCEPT_HEADER } from '../../config.js';

// Web fetch tool
export const webFetchTool = {
    // Tool definition
    name: 'web_fetch',
    description: 'Fetch content from URL.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to fetch.'
            }
        },
        required: ['url']
    },

    // Main execution function
    execute: async args => {
        const url = args.url;

        // Validate URL
        try {
            new URL(url);
        } catch {
            return handleToolError({ message: 'Invalid URL format' });
        }

        // Log fetch attempt
        logger.debug(`Fetching URL: ${url}`);

        try {
            // Fetch the URL
            const response = await fetch(url, {
                headers: {
                    'User-Agent': WEB_USER_AGENT,
                    Accept: WEB_ACCEPT_HEADER
                },
                signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS)
            });

            // Check for HTTP errors
            if (!response.ok) {
                return handleToolError({ message: `HTTP error: ${response.status} ${response.statusText}` });
            }

            // Process content based on type
            const contentType = response.headers.get('content-type') || '';
            let content;

            // Handle JSON and text/html content types
            if (contentType.includes('application/json')) {
                const json = await response.json();
                content = JSON.stringify(json);
            } else {
                content = await response.text();

                // Strip HTML tags for cleaner output
                if (contentType.includes('text/html')) {
                    content = extractTextFromHtml(content);
                }
            }

            // Truncate if too long
            if (content.length > WEB_MAX_CONTENT_LENGTH) {
                content = content.slice(0, WEB_MAX_CONTENT_LENGTH) + '\n... (content truncated)';
            }

            // Return fetched content
            return handleToolResponse(content);
        } catch (error) {
            return handleToolError({ error, message: 'Failed to fetch URL' });
        }
    }
};