import { handleToolError, handleToolResponse } from '../../utils/utils.js';
import { getAgentTypes } from '../../agent/agents.js';

// Start subagent tool
export const subagentStartTool = {
    // Tool definition
    name: 'subagent_start',
    description: 'Start a new subagent in the background.',
    get parameters() {
        return {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: getAgentTypes(),
                    description: 'Subagent type to start.'
                },
                prompt: {
                    type: 'string',
                    description: 'Natural-language task for the subagent.'
                }
            },
            required: ['type', 'prompt']
        };
    },

    // Main execution function
    execute: async (args, context) => {
        const { type, prompt } = args;

        try {
            // Launch the subagent and return its initial status
            const result = context.launchSubagent(type, prompt, context.sessionKey);
            return handleToolResponse({
                subagent_id: result.subagentId,
                type: result.type,
                name: result.name,
                status: 'started'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to start subagent' });
        }
    }
};