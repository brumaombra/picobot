import { ConversationManager } from '../../agent/conversation.js';
import { generateUniqueId } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { SUBAGENT_MODEL_TIERS, AGENT_TYPES } from '../../config.js';
import { getAgentTypeParameterPrompt, getModelTierParameterPrompt } from '../../agent/prompts.js';
import { getToolsDefinitions } from '../tools.js';
import { getOrCreateSession, addMessageToSession } from '../../session/manager.js';

// Subagent tool
export const subagentTool = {
    // Tool definition
    name: 'subagent',
    description: 'Delegate task to specialized AI subagent and wait for its completion. Subagent executes task autonomously with its own tools and returns results to you (not to user). Choose agent type based on task domain.',
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
                description: getAgentTypeParameterPrompt()
            },
            model_tier: {
                type: 'string',
                enum: Object.keys(SUBAGENT_MODEL_TIERS),
                description: getModelTierParameterPrompt()
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
        const selectedModel = SUBAGENT_MODEL_TIERS[model_tier]?.model || SUBAGENT_MODEL_TIERS.standard.model;
        const toolCategories = AGENT_TYPES[agent_type]?.tools || AGENT_TYPES.general.tools;

        // Generate a unique ID for the subagent session
        const subagentId = generateUniqueId('subagent');
        logger.info(`Spawning ${agent_type} subagent [${subagentId}]: ${label} (model: ${selectedModel}, categories: ${toolCategories.join(', ')})`);

        try {
            // Create conversation manager for subagent (The conversation manager handles the main agent loop for the subagent)
            const conversation = new ConversationManager({
                llm: context.llm,
                model: selectedModel
            });

            // Initialize subagent session with specialized system prompt
            const session = getOrCreateSession(subagentId);
            if (session.messages.length === 0) {
                const agentTypePrompt = AGENT_TYPES[agent_type].systemPrompt || AGENT_TYPES.general.systemPrompt;
                addMessageToSession(subagentId, {
                    role: 'system',
                    content: agentTypePrompt
                });
            }

            // Add user task to subagent session
            addMessageToSession(subagentId, {
                role: 'user',
                content: task
            });

            // Get tool definitions for subagent
            const toolDefinitions = getToolsDefinitions({
                categories: toolCategories,
                denied: ['subagent', 'message'] // Prevent recursive spawning and direct user messaging
            });

            // Build execution context for subagent
            const subagentContext = {
                workingDir: context.workingDir,
                channel: context.channel,
                chatId: context.chatId,
                llm: context.llm,
                config: context.config
            };

            // Run subagent conversation and await its completion
            const result = await conversation.run(subagentId, toolDefinitions, subagentContext);

            // Log completion
            logger.info(`Subagent [${subagentId}] completed: ${label}`);

            // Return subagent's final response to parent agent
            if (result.response) {
                return {
                    success: true,
                    output: result.response
                };
            } else if (result.reachedMaxIterations) {
                return {
                    success: false,
                    output: '',
                    error: 'Subagent reached maximum iterations without completing task'
                };
            } else {
                return {
                    success: false,
                    output: '',
                    error: 'Subagent completed without producing a response'
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Subagent [${subagentId}] error: ${errorMessage}`);
            return {
                success: false,
                output: '',
                error: `Subagent failed: ${errorMessage}`
            };
        }
    }
};