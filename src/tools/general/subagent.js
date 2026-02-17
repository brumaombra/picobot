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
                status: 'running'
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to start subagent' });
        }
    }
};

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
            const result = context.chatSubagent(subagent_id, prompt);
            return handleToolResponse({
                subagent_id: result.subagentId,
                type: result.type,
                name: result.name,
                status: result.status,
                message: result.message
            });
        } catch (error) {
            return handleToolError({ error, message: 'Failed to chat with subagent' });
        }
    }
};

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