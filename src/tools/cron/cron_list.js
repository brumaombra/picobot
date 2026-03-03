import { crons, serializeCron } from '../../crons/manager.js';
import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// List all crons tool
export const cronListTool = {
    // Tool definition
    name: 'cron_list',
    description: 'List all scheduled crons with metadata. Use cron_get to get detailed information.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async () => {
        try {
            // List all crons
            const cronsList = [...crons.values()].map(serializeCron);
            if (cronsList.length === 0) {
                return handleToolResponse('No scheduled crons found.');
            }

            // Return metadata only
            const metadata = cronsList.map(cronEntry => ({
                id: cronEntry.id,
                name: cronEntry.name,
                schedule: cronEntry.schedule,
                action: cronEntry.action
            }));

            // Return the list of crons
            return handleToolResponse(metadata);
        } catch (error) {
            return handleToolError({ error, message: 'Cron list failed' });
        }
    }
};