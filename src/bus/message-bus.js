import EventEmitter from 'eventemitter3';
import { QUEUE_POLL_TIMEOUT_MS } from '../config.js';

// Message bus state
const emitter = new EventEmitter();
const inboundQueue = [];
const inboundWaiters = [];

/**************** Inbound (Channel → Agent) ****************/

// Add message to inbound queue
export const pushInbound = message => {
    const waiter = inboundWaiters.shift();

    // If agent is waiting, deliver immediately, otherwise queue it
    if (waiter) {
        waiter.resolve(message);
        clearTimeout(waiter.timeoutId);
    } else {
        inboundQueue.push(message);
    }
};

// Get next inbound message (blocks until available or timeout)
export const pullInbound = (timeoutMs = QUEUE_POLL_TIMEOUT_MS) => {
    // Return queued message if available
    if (inboundQueue.length > 0) {
        return Promise.resolve(inboundQueue.shift());
    }

    // Wait for next message with timeout
    return new Promise(resolve => {
        // Set up timeout
        const timeoutId = setTimeout(() => {
            removeWaiter(waiter);
            resolve(null);
        }, timeoutMs);

        // Set up waiter
        const waiter = { resolve, timeoutId };
        inboundWaiters.push(waiter);
    });
};

// Remove a waiter from the list
const removeWaiter = waiter => {
    const index = inboundWaiters.indexOf(waiter);
    if (index > -1) {
        inboundWaiters.splice(index, 1);
    }
};

/**************** Outbound (Agent → Channel) ****************/

// Send outbound message to all listeners
export const sendOutbound = message => {
    emitter.emit('outbound', message);
};

// Subscribe to outbound messages
export const onOutbound = handler => {
    emitter.on('outbound', handler);
};

/**************** Cleanup ****************/

// Clear all state
export const clearMessageBus = () => {
    inboundQueue.length = 0;
    inboundWaiters.forEach(waiter => clearTimeout(waiter.timeoutId));
    inboundWaiters.length = 0;
    emitter.removeAllListeners();
};