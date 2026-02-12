import { ConversationManager } from '../../agent/conversation.js';
import { generateUniqueId } from '../../utils/utils.js';
import { logger } from '../../utils/logger.js';
import { buildSubagentSystemPrompt } from '../../agent/prompts.js';
import { getToolsDefinitions } from '../tools.js';
import { getOrCreateSession, addMessageToSession } from '../../session/manager.js';
import { getAgent, getAgents, getAgentIds } from '../../agent/agents.js';

// Subagent tool
export const subagentTool = {
    // Tool definition
    name: 'subagent',
    description: 'Delegate task to a specialized AI subagent for autonomous execution. Each agent has specific expertise and a dedicated set of tools.',
    get parameters() {
        return {
            type: 'object',
            properties: {
                agent: {
                    type: 'string',
                    enum: getAgentIds(),
                    description: 'The ID of the specialized agent to delegate to.'
                },
                task: {
                    type: 'string',
                    description: 'Detailed task description with all context and requirements.'
                }
            },
            required: ['agent', 'task']
        };
    },

    // Main execution function
    execute: async (args, context) => {
        const { agent: agentId, task } = args;

        // Validate context
        if (!context?.llm || !context?.model) {
            return {
                success: false,
                error: 'No LLM provider or model available in context'
            };
        }

        // Look up agent definition
        const agentDef = getAgent(agentId);
        if (!agentDef) {
            const available = [...getAgents().keys()].join(', ');
            return {
                success: false,
                error: `Unknown agent "${agentId}". Available agents: ${available}`
            };
        }

        // Use the same model as the parent agent
        const selectedModel = context.model;

        // Generate a unique ID for the subagent session
        const subagentId = generateUniqueId('subagent');
        logger.info(`Spawning subagent [${subagentId}]: ${agentDef.name} (model: ${selectedModel})`);

        try {
            // Create conversation manager for subagent
            const conversation = new ConversationManager({
                llm: context.llm,
                model: selectedModel
            });

            // Initialize subagent session with system prompt built from agent definition
            const session = getOrCreateSession(subagentId);
            if (session.messages.length === 0) {
                const systemPrompt = buildSubagentSystemPrompt(agentDef);

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

            // Get tool definitions filtered to the agent's allowed tools only
            const toolDefinitions = getToolsDefinitions(agentDef.allowedTools);

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

            // Log completion
            logger.info(`Subagent [${subagentId}] completed: ${agentDef.name}`);

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