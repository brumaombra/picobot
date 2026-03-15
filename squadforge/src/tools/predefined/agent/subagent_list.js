// List active subagents tool
export const subagentListTool = {
    name: 'subagent_list',
    description: 'List all currently active background subagents for the current session.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },

    // Main execution function
    execute: async (_args, { listActiveSubagents }) => {
        // Get the list of active subagents
        const activeSubagents = listActiveSubagents();

        // Return the list of active subagents
        return {
            active_subagents: activeSubagents,
            count: activeSubagents.length
        };
    }
};