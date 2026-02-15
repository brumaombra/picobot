import { getOrCreateSession, addMessageToSession } from '../session/manager.js';
import { getToolsDefinitions } from '../tools/tools.js';
import { buildSystemPrompt, getMainAgentAllowedTools } from './prompts.js';
import { logger } from '../utils/logger.js';
import { sendOutbound } from '../bus/message-bus.js';

// Message processor class
export class MessageProcessor {
    // Create a new message processor instance
    constructor({ agent, workspacePath, config }) {
        // Validate required dependencies
        if (!agent || !workspacePath) {
            throw new Error('Agent and workspace path are required');
        }

        // Store dependencies
        this.agent = agent;
        this.workspacePath = workspacePath;
        this.config = config;
        this.baseToolDefs = getToolsDefinitions(getMainAgentAllowedTools()); // Tool definitions filtered to main agent's allowed tools
    }

    // Process a single inbound message
    async process(message) {
        // Log the message
        logger.info(`Processing message for session ${message.sessionKey}`);

        try {
            // Build execution context
            const context = this.buildContext(message);

            // Initialize session with system prompt if needed
            this.initializeSession(message.sessionKey);

            // Add user message
            addMessageToSession(message.sessionKey, {
                role: 'user',
                content: message.content
            });

            // Get tool definitions for the LLM
            const toolDefs = this.baseToolDefs;

            // Run the conversation loop with callback for intermediate messages
            const result = await this.agent.run(message.sessionKey, toolDefs, context, content => {
                // Send intermediate messages immediately as they arrive
                sendOutbound({
                    sessionKey: message.sessionKey,
                    content
                });
            });

            // Check if we have a final response to send back
            if (result.response) {
                // Send final response back to user
                sendOutbound({
                    sessionKey: message.sessionKey,
                    content: result.response
                });
            } else if (result.timedOut) {
                // Send timeout message back
                logger.warn(`Time limit reached for session ${message.sessionKey}`);
                sendOutbound({
                    sessionKey: message.sessionKey,
                    content: "I've run out of time for this task. Let me know if you'd like me to continue!"
                });
            }
        } catch (error) {
            this.handleError(message, error); // Handle processing error
        }
    }

    // Build execution context for tools
    buildContext(message) {
        return {
            workingDir: this.workspacePath,
            sessionKey: message.sessionKey,
            llm: this.agent.llm,
            model: this.agent.model,
            config: this.config
        };
    }

    // Initialize session with system prompt if needed
    initializeSession(sessionKey) {
        // Get session and check if it's new
        const session = getOrCreateSession(sessionKey);

        // Add system prompt if this is a new session
        if (session.messages.length === 0) {
            // Create the system prompt
            const systemPrompt = buildSystemPrompt();

            // Add system prompt to session
            addMessageToSession(sessionKey, {
                role: 'system',
                content: systemPrompt
            });
        }
    }

    // Handle processing error
    handleError(message, error) {
        // Log processing error
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing message: ${errorMessage}`);

        // Send error message back
        sendOutbound({
            sessionKey: message.sessionKey,
            content: `Sorry, I encountered an error: ${errorMessage}`
        });
    }
}