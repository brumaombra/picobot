import { EventEmitter } from 'events';

// Simple in-memory bus for background inbound and outbound chat messages
export class MessageBus {
    // Constructor
    constructor() {
        this.emitter = new EventEmitter();
        this.inboundQueue = [];
        this.inboundWaiters = [];
    }

    // Push a message into the inbound queue
    pushInbound(message) {
        const waiter = this.inboundWaiters.shift();
        if (waiter) {
            clearTimeout(waiter.timeoutId);
            waiter.resolve(message);
            return;
        }

        this.inboundQueue.push(message);
    }

    // Pull the next inbound message, waiting up to the timeout when needed
    pullInbound(timeoutMs) {
        if (this.inboundQueue.length > 0) {
            return Promise.resolve(this.inboundQueue.shift());
        }

        return new Promise(resolve => {
            const waiter = {
                resolve,
                timeoutId: null
            };

            waiter.timeoutId = setTimeout(() => {
                this.removeWaiter(waiter);
                resolve(null);
            }, timeoutMs);

            this.inboundWaiters.push(waiter);
        });
    }

    // Emit an outbound message to listeners
    sendOutbound(message) {
        this.emitter.emit('outbound', message);
    }

    // Subscribe to outbound messages
    onOutbound(handler) {
        this.emitter.on('outbound', handler);
        return () => {
            this.emitter.off('outbound', handler);
        };
    }

    // Clear all queued and subscribed state
    clear() {
        this.inboundQueue.length = 0;
        for (const waiter of this.inboundWaiters) {
            clearTimeout(waiter.timeoutId);
            waiter.resolve(null);
        }
        this.inboundWaiters.length = 0;
        this.emitter.removeAllListeners();
    }

    // Remove a waiter from the pending list
    removeWaiter(waiter) {
        const index = this.inboundWaiters.indexOf(waiter);
        if (index >= 0) {
            this.inboundWaiters.splice(index, 1);
        }
    }
}