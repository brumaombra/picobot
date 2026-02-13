import { logger } from '../../utils/logger.js';
import { getConfigValue } from '../../config/config.js';
import { BRAVE_SEARCH_TIMEOUT_MS } from '../../config.js';
import { handleToolError } from '../../utils/utils.js';

// Web search tool using Brave Search API
export const webSearchTool = {
    // Tool definition
    name: 'web_search',
    description: 'Search the web using Brave Search API. Returns relevant search results with titles, URLs, and descriptions.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query string.'
            },
            count: {
                type: 'number',
                description: 'Number of results to return (1-20). Default is 10.'
            }
        },
        required: ['query']
    },

    // Main execution function
    execute: async args => {
        const query = args.query;
        const count = Math.min(Math.max(args.count || 10, 1), 20); // Clamp between 1 and 20

        // Check if Brave API key is configured
        const apiKey = getConfigValue('brave.apiKey');
        if (!apiKey) {
            return handleToolError({ message: 'Brave Search API key not configured. Please add brave.apiKey to your config.' });
        }

        // Log search attempt
        logger.debug(`Searching web: "${query}" (count: ${count})`);

        try {
            // Build API URL
            const url = new URL('https://api.search.brave.com/res/v1/web/search');
            url.searchParams.append('q', query);
            url.searchParams.append('count', count.toString());

            // Make API request
            const response = await fetch(url.toString(), {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'X-Subscription-Token': apiKey
                },
                signal: AbortSignal.timeout(BRAVE_SEARCH_TIMEOUT_MS)
            });

            // Check for HTTP errors
            if (!response.ok) {
                const errorText = await response.text();
                return handleToolError({ message: `Brave Search API error: ${response.status} ${response.statusText} - ${errorText}` });
            }

            // Parse response
            const data = await response.json();

            // Extract search results
            const results = data.web?.results || [];
            if (results.length === 0) {
                return {
                    success: true,
                    output: `No results found for query: "${query}"`
                };
            }

            // Format results
            const formattedResults = results.map((result, index) => ({
                position: index + 1,
                title: result.title,
                url: result.url,
                description: result.description || '',
                age: result.age || undefined
            }));

            // Log search completion
            logger.debug(`Web search completed: ${results.length} results found`);

            // Return formatted results
            return {
                success: true,
                output: {
                    count: results.length,
                    results: formattedResults
                }
            };
        } catch (error) {
            return handleToolError({ error, message: 'Failed to search web' });
        }
    }
};