// Create the built-in delegate tool for the current agent context
export const createDelegateToAgentTool = ({ squad, agent }) => {
    // Tool definition
    return {
        name: 'delegate_to_agent',
        description: 'Delegate work to a specialized agent and wait for its final response.',
        get parameters() {
            return {
                type: 'object',
                properties: {
                    agentId: {
                        type: 'string',
                        enum: squad.listSubagentSpecs().map(spec => spec.id),
                        description: 'The id of the specialized agent to run.'
                    },
                    prompt: {
                        type: 'string',
                        description: 'The task to delegate to the specialized agent.'
                    }
                },
                required: ['agentId', 'prompt']
            };
        },

        // Main execution function
        execute: async ({ agentId, prompt }) => {
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
};