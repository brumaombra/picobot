import { deleteCron } from '../../../src/crons/manager.js';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Delete cron tool
export const cronDeleteTool = {
    // Tool definition
    name: 'cron_delete',
    description: 'Delete a scheduled cron.',
    parameters: {
        type: 'object',
        properties: {
            cronId: {
                type: 'string',
                description: 'Cron ID to delete.'
            }
        },
        required: ['cronId']
    },

    // Main execution function
    execute: async args => {
        try {
            // Delete the cron
            const deletedCron = deleteCron(args.cronId);

            // Return success response
            return handleToolResponse(`Cron "${deletedCron.name}" deleted successfully`);
        } catch (error) {
            return handleToolError({ error, message: 'Cron delete failed' });
        }
    }
};