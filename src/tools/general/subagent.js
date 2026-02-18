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