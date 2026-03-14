import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Chat with subagent tool
export const subagentChatTool = {
    // Tool definition
    name: 'subagent_chat',
    description: 'Send a natural-language message to a running subagent.',
    parameters: {
        type: 'object',
        properties: {
            subagent_id: {
                type: 'string',
                description: 'Running subagent instance identifier.'
            },
            prompt: {
                type: 'string',
                description: 'Message to send to the running subagent.'
            }
        },
        required: ['subagent_id', 'prompt']
    },

    // Main execution function
    execute: async (args, context) => {
        const { subagent_id, prompt } = args;

        try {
            // Send a message to the subagent and return its response
            const result = await context.chatSubagent(subagent_id, prompt);
            return handleToolResponse({
                subagent_id: result.subagentId,
                type: result.type,
                name: result.name,
                status: result.status,
                response: result.response,
                timed_out: result.timedOut
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to chat with subagent' });
        }
    }
};