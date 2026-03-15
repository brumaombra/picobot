// Ask main agent tool
export const askMainAgentTool = {
    name: 'ask_main_agent',
    description: 'Ask the main agent a question and wait for its reply before continuing.',
    parameters: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'The question or clarification request to send to the main agent.'
            }
        },
        required: ['question']
    },

    // Main execution function
    execute: async ({ question }, { subagentId, askMainAgent }) => {
        // Validate the subagent context
        if (!subagentId) {
            throw new Error('ask_main_agent can only be called from within a running subagent.');
        }

        // Ask the main agent the question and wait for the answer
        return {
            answer: await askMainAgent(question)
        };
    }
};