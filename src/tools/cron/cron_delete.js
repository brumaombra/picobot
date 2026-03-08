import { logger } from '../../utils/common/logger.js';
import { crons } from '../../crons/manager.js';
import { deleteCronFile } from '../../crons/persistent.js';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

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
            // Get cron details
            const cronEntry = crons.get(args.cronId);
            if (!cronEntry) {
                return handleToolError({ message: `Cron not found: ${args.cronId}` });
            }

            // Stop and destroy the task
            cronEntry.task.stop();
            cronEntry.task.destroy();

            // Remove from memory
            crons.delete(args.cronId);

            // Remove from disk
            deleteCronFile(args.cronId);
            logger.info(`Deleted cron: ${cronEntry.name}`);

            // Return success response
            return handleToolResponse(`Cron "${cronEntry.name}" deleted successfully`);
        } catch (error) {
            return handleToolError({ error, message: 'Cron delete failed' });
        }
    }
};