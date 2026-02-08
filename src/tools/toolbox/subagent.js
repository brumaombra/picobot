import { Agent } from '../../agent/agent.js';
import { generateUniqueId } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { SUBAGENT_MODEL_TIERS, AGENT_TYPES } from '../../config.js';

// Subagent tool
export const subagentTool = {
    // Tool definition
    name: 'subagent',
    description: 'Spawn specialized AI agent to handle task in parallel while you continue. Choose agent type based on task domain. Subagent reports results to user when done. Returns immediately.',
    parameters: {
        type: 'object',
        properties: {
            task: {
                type: 'string',
                description: 'Complete, detailed task description. Be specific with all context, requirements, and constraints. Subagent has no access to your conversation history.'
            },
            label: {
                type: 'string',
                description: 'Brief label for subagent (2-5 words, e.g., "API Documentation Fetch"). Used for logging and identification.'
            },
            agent_type: {
                type: 'string',
                enum: Object.keys(AGENT_TYPES),
                description: 'Specialization of the agent: "general" (core tools only), "email" (Gmail specialist), "calendar" (Google Calendar specialist), "drive" (Google Drive specialist). Choose based on task requirements.'
            },
            model_tier: {
                type: 'string',
                enum: Object.keys(SUBAGENT_MODEL_TIERS),
                description: 'Model tier to use based on task complexity and desired performance.'
            }
        },
        required: ['task', 'label']
    },

    // Main execution function
    execute: async (args, context) => {
        const { task, label, agent_type = 'general', model_tier = 'standard' } = args;

        // Validate context
        if (!context?.llm) {
            return {
                success: false,
                output: '',
                error: 'No LLM provider available in context'
            };
        }

        // Get model and tool categories from config
        const selectedModel = SUBAGENT_MODEL_TIERS[model_tier];
        const toolCategories = AGENT_TYPES[agent_type] || AGENT_TYPES.general;

        // Generate a unique ID for the subagent session
        const subagentId = generateUniqueId('subagent');
        logger.info(`Spawning ${agent_type} subagent [${subagentId}]: ${label} (model: ${selectedModel}, categories: ${toolCategories.join(', ')})`);

        // Create a new agent instance with the selected model tier and specialized tools
        const subagent = new Agent({
            llm: context.llm,
            model: selectedModel,
            workspacePath: context.workingDir,
            config: context.config,
            tools: {
                categories: toolCategories, // Pass specific tool categories based on agent type
                denied: ['subagent'] // Deny the subagent tool to prevent recursive spawning
            }
        });

        // Fire and forget the subagent - it will run independently and report back when done
        subagent.messageProcessor.process({
            channel: context.channel,
            chatId: context.chatId,
            senderId: subagentId,
            sessionKey: subagentId,
            content: task
        });

        // Return success response immediately
        return {
            success: true,
            output: `${agent_type.charAt(0).toUpperCase() + agent_type.slice(1)} subagent spawned: "${label}". It will run in the background and report back when done.`
        };
    }
};