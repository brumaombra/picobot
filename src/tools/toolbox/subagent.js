import { Agent } from '../../agent/agent.js';
import { generateUniqueId, getModelTiers } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { SUBAGENT_MODEL_TIERS } from '../../config.js';

// Subagent tool
export const subagentTool = {
    // Tool definition
    name: 'subagent',
    description: 'Spawn independent AI agent to handle task in parallel while you continue. Use ONLY for: complex independent tasks, time-consuming operations, or simultaneous work. Subagent has same capabilities (except cannot spawn subagents). Reports results to user when done. Returns immediately.',
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
            model_tier: {
                type: 'string',
                enum: getModelTiers(),
                description: 'Model tier to use based on task complexity and desired performance.'
            }
        },
        required: ['task', 'label']
    },

    // Main execution function
    execute: async (args, context) => {
        const { task, label, model_tier = 'standard' } = args;

        // Validate context
        if (!context?.llm) {
            return {
                success: false,
                output: '',
                error: 'No LLM provider available in context'
            };
        }

        // Validate model tier
        if (!getModelTiers().includes(model_tier)) {
            return {
                success: false,
                output: '',
                error: `Invalid model_tier: ${model_tier}. Must be one of: ${getModelTiers().join(', ')}`
            };
        }

        // Get the model for the selected tier
        const selectedModel = SUBAGENT_MODEL_TIERS[model_tier];

        // Generate a unique ID for the subagent session
        const subagentId = generateUniqueId('subagent');
        logger.info(`Spawning subagent [${subagentId}]: ${label} (model: ${selectedModel})`);

        // Create a new agent instance with the selected model tier
        const subagent = new Agent({
            llm: context.llm,
            model: selectedModel,
            workspacePath: context.workingDir,
            config: context.config,
            tools: { denied: ['subagent'] } // Deny the subagent tool to prevent recursive spawning
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
            output: `Subagent spawned: "${label}". It will run in the background and report back when done.`
        };
    }
};