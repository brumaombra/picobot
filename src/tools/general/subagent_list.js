import { handleToolError, handleToolResponse } from '../../utils/utils.js';

// List active subagents tool
export const subagentListTool = {
    // Tool definition
    name: 'subagent_list',
    description: 'List all currently active subagents.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async (_args, context) => {
        try {
            // Get the list of active subagents and return it
            const activeSubagents = context.listActiveSubagents();
            return handleToolResponse({
                active_subagents: activeSubagents,
                count: activeSubagents.length
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to list active subagents' });
        }
    }
};