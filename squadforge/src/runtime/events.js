export const onRuntimeEvent = (runtime, eventId, handler) => {
    if (!eventId) {
        throw new Error('Runtime event registration requires an eventId.');
    }

    if (typeof handler !== 'function') {
        throw new Error('Runtime event registration requires a handler function.');
    }

    const handlers = runtime.eventHandlers.get(eventId) || new Set();
    handlers.add(handler);
    runtime.eventHandlers.set(eventId, handlers);

    return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
            runtime.eventHandlers.delete(eventId);
        }
    };
};

export const emitRuntimeEvent = (runtime, eventId, eventData = {}) => {
    const handlers = runtime.eventHandlers.get(eventId) || new Set();
    if (handlers.size === 0) {
        return;
    }

    for (const handler of handlers) {
        handler(eventData);
    }
};