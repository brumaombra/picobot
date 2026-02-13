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
    description: 'Delegate task to a specialized AI subagent for autonomous execution. Each agent has specific expertise and a dedicated set of tools. To continue a previous subagent session (e.g. to answer a clarification request), pass the session_id returned from the previous call.',
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
                    description: 'Detailed task description with all context and requirements. When resuming a session, this is your reply to the subagent\'s clarification question.'
                },
                session_id: {
                    type: 'string',
                    description: 'Optional. The session_id from a previous subagent call to resume that conversation (e.g. to answer a clarification request).'
                }
            },
            required: ['agent', 'task']
        };
    },

    // Main execution function
    execute: async (args, context) => {
        const { agent: agentId, task, session_id: existingSessionId } = args;

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

        // Reuse existing session or generate a new one
        const subagentId = existingSessionId || generateUniqueId('subagent');
        const isResuming = !!existingSessionId;
        logger.info(`${isResuming ? 'Resuming' : 'Spawning'} subagent [${subagentId}]: ${agentDef.name} (model: ${selectedModel})`);

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

            // Return subagent's final response to parent agent (structured JSON with session_id and message)
            if (result.response) {
                return {
                    success: true,
                    output: {
                        sessionId: subagentId,
                        message: result.response
                    }
                };
            } else if (result.reachedMaxIterations) {
                return {
                    success: false,
                    error: `Subagent reached maximum iterations without completing task (session_id: ${subagentId})`
                };
            } else {
                return {
                    success: false,
                    error: `Subagent completed without producing a response (session_id: ${subagentId})`
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