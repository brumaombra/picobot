// Start subagent tool
export const subagentStartTool = {
    name: 'subagent_start',
    description: 'Start a new subagent in the background and return immediately with its subagent_id.',
    parameters: {
        type: 'object',
        properties: {
            agentId: {
                type: 'string',
                description: 'The id of the specialized agent to start.'
            },
            prompt: {
                type: 'string',
                description: 'The task to delegate to the specialized agent.'
            }
        },
        required: ['agentId', 'prompt']
    },

    // Main execution function
    execute: async ({ agentId, prompt }, { launchSubagent }) => {
        // Launch the subagent
        const result = await launchSubagent(agentId, prompt);

        // Return the new subagent metadata
        return {
            subagent_id: result.subagentId,
            type: result.type,
            name: result.name,
            status: 'started'
        };
    }
};