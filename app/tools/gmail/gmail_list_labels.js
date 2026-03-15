import { logger } from '../../../squadforge/src/index.js';
import { getGmailClient } from '../../../src/utils/google/google-client.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Gmail labels tool
export default {
    // Tool definition
    name: 'gmail_list_labels',
    description: 'List Gmail labels.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async () => {
        // Log list labels attempt
        logger.debug('Listing Gmail labels');

        try {
            // Get Gmail client
            const gmail = await getGmailClient();

            // List all labels
            const response = await gmail.users.labels.list({
                userId: 'me'
            });

            // Format output
            const labels = response.data.labels.map(label => ({
                id: label.id,
                name: label.name,
                type: label.type
            }));

            // Return the list of labels
            return handleToolResponse(labels);
        } catch (error) {
            return handleToolError({ error, message: 'Gmail labels list failed' });
        }
    }
};