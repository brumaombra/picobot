import { getCron, serializeCron } from '../../crons/manager.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Get specific cron details tool
export const cronGetTool = {
    // Tool definition
    name: 'cron_get',
    description: 'Get detailed information about a specific cron by its ID.',
    parameters: {
        type: 'object',
        properties: {
            cronId: {
                type: 'string',
                description: 'Cron ID to get details for.'
            }
        },
        required: ['cronId']
    },

    // Main execution function
    execute: async args => {
        try {
            // Get the cron details
            const cronEntry = getCron(args.cronId);
            if (!cronEntry) {
                return handleToolError({ message: `Cron not found: ${args.cronId}` });
            }

            // Return the cron details
            return handleToolResponse(serializeCron(cronEntry));
        } catch (error) {
            return handleToolError({ error, message: 'Cron get failed' });
        }
    }
};