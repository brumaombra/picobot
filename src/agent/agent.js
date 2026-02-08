import { cleanupSessions } from '../session/manager.js';
import { logger } from '../utils/logger.js';
import { pullInbound } from '../bus/message-bus.js';
import { QUEUE_POLL_TIMEOUT_MS, SESSION_CLEANUP_INTERVAL_MS } from '../config.js';
import { ConversationManager } from './conversation.js';
import { MessageProcessor } from './message-processor.js';

// Agent class
export class Agent {
    // Create a new agent instance
    constructor({ llm, model, workspacePath, config, tools } = {}) {
        // Validate required dependencies
        if (!llm || !model || !workspacePath) {
            throw new Error('LLM, model, and workspace path are required');
        }

        // Initialize the conversation manager
        this.conversation = new ConversationManager({
            llm,
            model
        });

        // Initialize the message processor
        this.messageProcessor = new MessageProcessor({
            conversation: this.conversation,
            workspacePath,
            config,
            tools
        });

        // Agent state
        this.running = false;
    }

    // Start the agent loop
    async start() {
        // Set running flag
        this.running = true;
        logger.info('Agent loop started');

        // Clean up sessions periodically
        const cleanupInterval = setInterval(() => {
            cleanupSessions();
        }, SESSION_CLEANUP_INTERVAL_MS);

        // Main loop
        while (this.running) {
            try {
                const message = await pullInbound(QUEUE_POLL_TIMEOUT_MS);
                if (message) {
                    await this.messageProcessor.process(message);
                }
            } catch (error) {
                logger.error(`Agent loop error: ${error}`);
            }
        }

        // Clear cleanup interval
        clearInterval(cleanupInterval);
        logger.info('Agent loop stopped');
    }

    // Stop the agent loop
    stop() {
        this.running = false;
    }
}