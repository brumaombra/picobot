// Register a runtime event handler and return an unsubscribe function
export const onRuntimeEvent = (runtime, eventId, handler) => {
    // Validate the event id
    if (!eventId) {
        throw new Error('Runtime event registration requires an eventId.');
    }

    // Validate the event handler
    if (typeof handler !== 'function') {
        throw new Error('Runtime event registration requires a handler function.');
    }

    // Add the handler to the set of listeners for the event
    const handlers = runtime.eventHandlers.get(eventId) || new Set();
    handlers.add(handler);
    runtime.eventHandlers.set(eventId, handlers);

    // Return an unsubscribe function for removing the handler later
    return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
            runtime.eventHandlers.delete(eventId);
        }
    };
};

// Emit a runtime event to every registered handler for that event id
export const emitRuntimeEvent = (runtime, eventId, eventData = {}) => {
    // Resolve the registered handlers for the event
    const handlers = runtime.eventHandlers.get(eventId) || new Set();
    if (handlers.size === 0) {
        return;
    }

    // Notify each handler with the event payload
    for (const handler of handlers) {
        handler(eventData);
    }
};