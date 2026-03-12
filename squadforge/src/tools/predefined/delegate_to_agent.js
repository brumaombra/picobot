// Delegate to agent tool
export const delegateToAgentTool = {
    name: 'delegate_to_agent',
    description: 'Delegate work to a specialized agent and wait for its final response.',
    parameters: {
        type: 'object',
        properties: {
            agentId: {
                type: 'string',
                description: 'The id of the specialized agent to run.'
            },
            prompt: {
                type: 'string',
                description: 'The task to delegate to the specialized agent.'
            }
        },
        required: ['agentId', 'prompt']
    },

    // Main execution function
    execute: async ({ agentId, prompt }, { agent }) => {
        // Spawn the specified subagent
        const childAgent = agent.spawnSubagent(agentId, {
            prompt
        });

        // Wait for the subagent to complete its task
        const result = await childAgent.run();

        // Return the response
        return {
            agentId: childAgent.id,
            sessionId: childAgent.sessionId,
            response: result.response
        };
    }
};