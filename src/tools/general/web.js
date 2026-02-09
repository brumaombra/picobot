import { logger } from '../../utils/logger.js';
import { extractTextFromHtml } from '../../utils/utils.js';
import { WEB_MAX_CONTENT_LENGTH, WEB_FETCH_TIMEOUT_MS, WEB_USER_AGENT, WEB_ACCEPT_HEADER } from '../../config.js';

// Web fetch tool
export const webFetchTool = {
    // Tool definition
    name: 'web_fetch',
    description: 'Fetch content from URL and return as text. HTML auto-stripped to readable text, JSON formatted. Use for documentation, API data, or text resources. 10s timeout, large responses truncated. No JavaScript execution.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'Complete URL with protocol (e.g., "https://api.example.com/data"). Must be valid HTTP/HTTPS.'
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
            return {
                success: false,
                output: '',
                error: 'Invalid URL format'
            };
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
                return {
                    success: false,
                    output: '',
                    error: `HTTP error: ${response.status} ${response.statusText}`
                };
            }

            // Process content based on type
            const contentType = response.headers.get('content-type') || '';
            let content;

            // Handle JSON and text/html content types
            if (contentType.includes('application/json')) {
                const json = await response.json();
                content = JSON.stringify(json, null, 2);
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
            return {
                success: true,
                output: content
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                output: '',
                error: `Failed to fetch URL: ${message}`
            };
        }
    }
};