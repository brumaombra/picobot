import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Ask main agent tool — lets a subagent pause and ask the main agent a question mid-task
export const askMainAgentTool = {
    // Tool definition
    name: 'ask_main_agent',
    description: 'Ask the main agent a question and wait for its reply. Use this mid-task when you need clarification, approval, or information you cannot determine on your own. The subagent will pause until the main agent responds.',
    parameters: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'The question or message to send to the main agent.'
            }
        },
        required: ['question']
    },

    // Main execution function
    execute: async (args, context) => {
        const { question } = args;

        // This tool is only usable from within a running subagent
        if (!context.subagentId) {
            return handleToolError({ message: 'ask_main_agent can only be called from within a subagent.' });
        }

        try {
            // Block until the main agent replies via subagent_chat
            const answer = await context.askMainAgent(context.subagentId, question, context.sessionKey);
            return handleToolResponse({ answer });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to get a reply from the main agent' });
        }
    }
};