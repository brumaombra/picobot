import { ConversationManager } from '../../agent/conversation.js';
import { generateUniqueId } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { buildSubagentSystemPrompt } from '../../agent/prompts.js';
import { getToolsDefinitions } from '../tools.js';
import { getOrCreateSession, addMessageToSession } from '../../session/manager.js';

// Subagent tool
export const subagentTool = {
    // Tool definition
    name: 'subagent',
    description: 'Delegate task to AI subagent for autonomous execution.',
    parameters: {
        type: 'object',
        properties: {
            task: {
                type: 'string',
                description: 'Detailed task description with all context and requirements.'
            },
            label: {
                type: 'string',
                description: 'Brief label for identification (2-5 words).'
            }
        },
        required: ['task', 'label']
    },

    // Main execution function
    execute: async (args, context) => {
        const { task, label } = args;

        // Validate context
        if (!context?.llm || !context?.model) {
            return {
                success: false,
                error: 'No LLM provider or model available in context'
            };
        }

        // Use the same model as the parent agent
        const selectedModel = context.model;

        // Generate a unique ID for the subagent session
        const subagentId = generateUniqueId('subagent');
        logger.info(`Spawning subagent [${subagentId}]: ${label} (model: ${selectedModel})`);

        try {
            // Create conversation manager for subagent
            const conversation = new ConversationManager({
                llm: context.llm,
                model: selectedModel
            });

            // Initialize subagent session with system prompt
            const session = getOrCreateSession(subagentId);
            if (session.messages.length === 0) {
                const systemPrompt = buildSubagentSystemPrompt();

                // Add system prompt to subagent session
                addMessageToSession(subagentId, {
                    role: 'system',
                    content: systemPrompt
                });
            }

            // Add user task to subagent session
            addMessageToSession(subagentId, {
                role: 'user',
                content: task
            });

            // Get tool definitions for subagent
            const toolDefinitions = getToolsDefinitions({
                categories: ['general'],
                exclude: ['subagent'] // Prevent recursive spawning
            });

            // Build execution context for subagent
            const subagentContext = {
                workingDir: context.workingDir,
                channel: context.channel,
                chatId: context.chatId,
                llm: context.llm,
                model: selectedModel,
                config: context.config
            };

            // Run subagent conversation and await its completion
            const result = await conversation.run(subagentId, toolDefinitions, subagentContext);

            // Log completion and clean up one-shot session
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
                    error: 'Subagent reached maximum iterations without completing task'
                };
            } else {
                return {
                    success: false,
                    error: 'Subagent completed without producing a response'
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Subagent [${subagentId}] error: ${errorMessage}`);
            return {
                success: false,
                error: `Subagent failed: ${errorMessage}`
            };
        }
    }
};