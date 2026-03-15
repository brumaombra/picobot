import { DEFAULT_RUNTIME_TIMEOUT_MESSAGE } from '../config.js';
import { logger } from '../logging/logger.js';
import { normalizeRuntimeMessage } from './messages.js';
import { sendToSession } from './lookup.js';

// Runtime message handling
export const onRuntimeMessage = (runtime, handler) => {
    // Validate the handler
    if (typeof handler !== 'function') {
        throw new Error('Runtime inbound registration requires a handler function.');
    }

    // Set the inbound message handler
    runtime.inboundConnector = handler;
    return runtime;
};

// Emit a message into the runtime
export const sendRuntimeMessage = (runtime, handler) => {
    // Validate the handler 
    if (typeof handler !== 'function') {
        throw new Error('Runtime outbound registration requires a handler function.');
    }

    // Set the outbound message handler
    runtime.outboundMessageHandler = handler;
    return runtime;
};

// Queue a message directly into the runtime without going through an external channel connector
export const queueRuntimeMessage = (runtime, message) => {
    const normalizedMessage = normalizeRuntimeMessage(message);
    receiveInboundMessage(runtime, normalizedMessage);
    return normalizedMessage;
};

// Emit a normalized outbound message directly through the configured channel sender
export const emitRuntimeOutboundMessage = async (runtime, message) => {
    const normalizedMessage = normalizeRuntimeMessage(message);
    await emitOutboundMessage(runtime, normalizedMessage);
    return normalizedMessage;
};

// Receive an inbound message and resolve any waiting pull requests
const receiveInboundMessage = (runtime, message) => {
    // Try to resolve any pending pull requests for inbound messages
    const waiter = runtime.inboundWaiters.shift();
    if (waiter) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve(message);
        return;
    }

    // If no pending pull requests, queue the message for processing in the runtime loop
    runtime.inboundQueue.push(message);
};

// Remove a waiter from the list of pending inbound waiters
const removeInboundWaiter = (runtime, waiter) => {
    const index = runtime.inboundWaiters.indexOf(waiter);
    if (index >= 0) {
        runtime.inboundWaiters.splice(index, 1);
    }
};

// Resolve all pending inbound waiters with null (used when stopping the runtime)
const resolvePendingInboundWaiters = runtime => {
    const waiters = runtime.inboundWaiters.splice(0);
    for (const waiter of waiters) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve(null);
    }
};

// Pull an inbound message, waiting up to the specified timeout if no messages are currently available
const pullInboundMessage = (runtime, timeoutMs) => {
    // If there are messages in the inbound queue, return the next one immediately
    if (runtime.inboundQueue.length > 0) {
        return Promise.resolve(runtime.inboundQueue.shift());
    }

    // Otherwise, return a promise that will resolve when a new message is received or the timeout is reached
    return new Promise(resolve => {
        // Create a waiter object
        const waiter = {
            resolve,
            timeoutId: null
        };

        // Set a timeout to resolve the waiter
        waiter.timeoutId = setTimeout(() => {
            removeInboundWaiter(runtime, waiter);
            resolve(null);
        }, timeoutMs);

        // Add the waiter to the list of pending inbound waiters
        runtime.inboundWaiters.push(waiter);
    });
};

// Forward the outbound message to the configured channel sender
const emitOutboundMessage = async (runtime, message) => {
    if (typeof runtime.outboundMessageHandler === 'function') {
        await runtime.outboundMessageHandler(message);
    }
};

// Process one inbound channel message by routing it through the session runtime and emitting the reply
const processRuntimeMessage = async (runtime, message) => {
    const normalizedMessage = normalizeRuntimeMessage(message);
    const sessionId = normalizedMessage.sessionId;
    const role = normalizedMessage.role;
    const content = normalizedMessage.content;

    logger.debug(`Processing runtime message for session ${sessionId} with role ${role}`);

    try {
        // Send the inbound content to the appropriate session-backed root agent
        const result = await sendToSession(runtime, content, { sessionId, role });

        // Emit a normal assistant reply when the agent completed successfully
        if (result?.response) {
            // Create and emit the outbound message with the agent's response
            const outboundMessage = await emitRuntimeOutboundMessage(runtime, {
                sessionId,
                content: result.response,
                role: 'assistant',
                replyToId: normalizedMessage.replyToId,
                metadata: normalizedMessage.metadata,
                timedOut: false
            });

            // Return the outbound message
            return outboundMessage;
        }

        // Emit the configured timeout message when the agent hit its soft deadline
        if (result?.timedOut) {
            // Create and emit the outbound timeout message
            const timeoutOutboundMessage = await emitRuntimeOutboundMessage(runtime, {
                sessionId,
                content: runtime.timeoutMessage || DEFAULT_RUNTIME_TIMEOUT_MESSAGE,
                role: 'assistant',
                replyToId: normalizedMessage.replyToId,
                metadata: normalizedMessage.metadata,
                timedOut: true
            });

            // Return the outbound timeout message
            return timeoutOutboundMessage;
        }

        // Return the raw result
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Runtime message processing failed for session ${sessionId}: ${errorMessage}`);

        // Create and emit the outbound error object
        const errorOutboundMessage = await emitRuntimeOutboundMessage(runtime, {
            sessionId,
            content: `Sorry, I encountered an error: ${errorMessage}`,
            role: 'assistant',
            replyToId: normalizedMessage.replyToId,
            metadata: normalizedMessage.metadata,
            error: errorMessage
        });

        // Return the outbound error message
        return errorOutboundMessage;
    }
};

// Continuously pull inbound messages and process them until the runtime is stopped
const runRuntimeLoop = async runtime => {
    while (runtime.running) {
        // Pull the next inbound message
        const message = await pullInboundMessage(runtime, runtime.pollTimeoutMs);
        if (!message) {
            continue;
        }

        // Process the message and emit any outbound replies
        await processRuntimeMessage(runtime, message);
    }
};

// Start the background runtime loop and connect the external inbound channel if one is configured
export const startRuntime = async runtime => {
    // If the runtime is already running, do nothing
    if (runtime.running) {
        return runtime;
    }

    // Initialize runtime-owned crons before processing inbound traffic
    const cronManager = runtime.cronManager;
    if (cronManager) {
        cronManager.initialize();
    }

    // Register the runtime receiver and keep the optional detach hook for shutdown
    if (runtime.inboundConnector) {
        runtime.detachInboundConnector = await runtime.inboundConnector(message => receiveInboundMessage(runtime, message));
    }

    // Start the runtime loop
    runtime.running = true;
    logger.info('Runtime started');
    runtime.loopPromise = runRuntimeLoop(runtime);
    return runtime;
};

// Stop the runtime loop, release pending waits, and disconnect the external inbound channel
export const stopRuntime = async runtime => {
    // If the runtime is not running, do nothing
    if (!runtime.running) {
        return;
    }

    // Signal the runtime loop to stop and wait for it to finish
    runtime.running = false;
    resolvePendingInboundWaiters(runtime);
    await runtime.loopPromise;
    runtime.loopPromise = null;

    // Stop any runtime-owned crons
    const cronManager = runtime.cronManager;
    if (cronManager) {
        cronManager.stop();
    }

    // Detach the inbound channel when a detach function is provided
    if (typeof runtime.detachInboundConnector === 'function') {
        await runtime.detachInboundConnector();
    }

    // Clear the inbound connector and detach hook
    runtime.detachInboundConnector = null;
    logger.info('Runtime stopped');
};