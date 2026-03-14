import { DEFAULT_LEADER_SESSION_ID, DEFAULT_RUNTIME_TIMEOUT_MESSAGE } from '../config.js';
import { normalizeSessionId } from '../utils/utils.js';
import { sendToSession } from './lookup.js';

export const onRuntimeMessage = (runtime, handler) => {
    if (typeof handler !== 'function') {
        throw new Error('Runtime inbound registration requires a handler function.');
    }

    runtime.inboundConnector = handler;
    return runtime;
};

export const sendRuntimeMessage = (runtime, handler) => {
    if (typeof handler !== 'function') {
        throw new Error('Runtime outbound registration requires a handler function.');
    }

    runtime.outboundMessageHandler = handler;
    return runtime;
};

export const receiveInboundMessage = (runtime, message) => {
    const waiter = runtime.inboundWaiters.shift();
    if (waiter) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve(message);
        return;
    }

    runtime.inboundQueue.push(message);
};

export const removeInboundWaiter = (runtime, waiter) => {
    const index = runtime.inboundWaiters.indexOf(waiter);
    if (index >= 0) {
        runtime.inboundWaiters.splice(index, 1);
    }
};

export const resolvePendingInboundWaiters = runtime => {
    const waiters = runtime.inboundWaiters.splice(0);
    for (const waiter of waiters) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve(null);
    }
};

export const pullInboundMessage = (runtime, timeoutMs) => {
    if (runtime.inboundQueue.length > 0) {
        return Promise.resolve(runtime.inboundQueue.shift());
    }

    return new Promise(resolve => {
        const waiter = {
            resolve,
            timeoutId: null
        };

        waiter.timeoutId = setTimeout(() => {
            removeInboundWaiter(runtime, waiter);
            resolve(null);
        }, timeoutMs);

        runtime.inboundWaiters.push(waiter);
    });
};

export const emitOutboundMessage = async (runtime, message) => {
    if (typeof runtime.outboundMessageHandler === 'function') {
        await runtime.outboundMessageHandler(message);
    }
};

export const processRuntimeMessage = async (runtime, message) => {
    const sessionId = normalizeSessionId(message?.sessionId);
    const role = message?.role || 'user';
    const content = message?.content || '';

    try {
        const result = await sendToSession(runtime, content, { sessionId, role });

        if (result?.response) {
            const outboundMessage = {
                sessionId,
                content: result.response,
                role: 'assistant',
                replyToId: message?.replyToId,
                metadata: message?.metadata,
                timedOut: false
            };
            await emitOutboundMessage(runtime, outboundMessage);
            return outboundMessage;
        }

        if (result?.timedOut) {
            const timeoutOutboundMessage = {
                sessionId,
                content: runtime.timeoutMessage || DEFAULT_RUNTIME_TIMEOUT_MESSAGE,
                role: 'assistant',
                replyToId: message?.replyToId,
                metadata: message?.metadata,
                timedOut: true
            };
            await emitOutboundMessage(runtime, timeoutOutboundMessage);
            return timeoutOutboundMessage;
        }

        return result;
    } catch (error) {
        const errorOutboundMessage = {
            sessionId,
            content: runtime.formatErrorMessage(error),
            role: 'assistant',
            replyToId: message?.replyToId,
            metadata: message?.metadata,
            error: error instanceof Error ? error.message : String(error)
        };
        await emitOutboundMessage(runtime, errorOutboundMessage);
        return errorOutboundMessage;
    }
};

export const runRuntimeLoop = async runtime => {
    while (runtime.running) {
        const message = await pullInboundMessage(runtime, runtime.pollTimeoutMs);
        if (!message) {
            continue;
        }

        await processRuntimeMessage(runtime, message);
    }
};

export const startRuntime = async runtime => {
    if (runtime.running) {
        return runtime;
    }

    if (runtime.inboundConnector) {
        runtime.detachInboundConnector = await runtime.inboundConnector(message => receiveInboundMessage(runtime, message));
    }

    runtime.running = true;
    runtime.loopPromise = runRuntimeLoop(runtime);
    return runtime;
};

export const stopRuntime = async runtime => {
    if (!runtime.running) {
        return;
    }

    runtime.running = false;
    resolvePendingInboundWaiters(runtime);
    await runtime.loopPromise;
    runtime.loopPromise = null;

    if (typeof runtime.detachInboundConnector === 'function') {
        await runtime.detachInboundConnector();
    }
    runtime.detachInboundConnector = null;
};