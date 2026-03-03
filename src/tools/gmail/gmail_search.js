import { logger } from '../../utils/logger.js';
import { getGmailClient } from '../../utils/google-client.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// Gmail search tool
export const gmailSearchTool = {
    // Tool definition
    name: 'gmail_search',
    description: 'Search Gmail messages.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query.'
            },
            maxResults: {
                type: 'number',
                description: 'Max results (default: 10).'
            }
        },
        required: ['query']
    },

    // Main execution function
    execute: async args => {
        const { query, maxResults = 10 } = args;

        // Log search attempt
        logger.debug(`Searching Gmail: ${query}`);

        try {
            // Get Gmail client
            const gmail = await getGmailClient();

            // List messages matching query
            const listResponse = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: Math.min(maxResults, 50)
            });

            // Check if any messages found
            if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
                return handleToolResponse('No messages found matching the query.');
            }

            // Fetch full metadata for each message
            const messages = await Promise.all(
                listResponse.data.messages.map(async msg => {
                    const details = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'metadata',
                        metadataHeaders: ['From', 'To', 'Subject', 'Date']
                    });
                    return details.data;
                })
            );

            // Format output
            const formatted = messages.map(msg => {
                const headers = {};

                // Extract relevant headers
                msg.payload.headers.forEach(h => {
                    headers[h.name] = h.value;
                });

                // Return formatted message info
                return {
                    id: msg.id,
                    threadId: msg.threadId,
                    subject: headers.Subject || '(No subject)',
                    from: headers.From || '',
                    to: headers.To || '',
                    date: headers.Date || '',
                    snippet: msg.snippet
                };
            });

            // Return the list of messages
            return handleToolResponse(formatted);
        } catch (error) {
            return handleToolError({ error, message: 'Gmail search failed' });
        }
    }
};