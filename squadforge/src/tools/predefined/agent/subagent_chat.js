// Chat with subagent tool
export const subagentChatTool = {
    name: 'subagent_chat',
    description: 'Send a natural-language message to a subagent by subagent_id.',
    parameters: {
        type: 'object',
        properties: {
            subagent_id: {
                type: 'string',
                description: 'Running or resumable subagent instance identifier.'
            },
            prompt: {
                type: 'string',
                description: 'Message to send to the subagent.'
            }
        },
        required: ['subagent_id', 'prompt']
    },

    // Main execution function
    execute: async ({ subagent_id, prompt }, { chatSubagent }) => {
        return chatSubagent(subagent_id, prompt);
    }
};