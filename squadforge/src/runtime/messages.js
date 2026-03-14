import { normalizeSessionId } from '../utils/utils.js';

// Normalize a file attachment payload used by runtime channels
export const normalizeRuntimeFile = file => {
    // Treat missing file payloads as no attachment
    if (file === null || file === undefined) {
        return null;
    }

    // Validate the basic file payload shape
    if (typeof file !== 'object' || Array.isArray(file)) {
        throw new Error('Runtime file payload must be an object when provided.');
    }

    // Validate the required file path field
    if (!file.path || typeof file.path !== 'string') {
        throw new Error('Runtime file payload requires a string path.');
    }

    // Return the normalized runtime file attachment
    return {
        path: file.path,
        caption: typeof file.caption === 'string' ? file.caption : undefined,
        name: typeof file.name === 'string' ? file.name : undefined,
        mimeType: typeof file.mimeType === 'string' ? file.mimeType : undefined,
        metadata: file.metadata && typeof file.metadata === 'object' && !Array.isArray(file.metadata) ? file.metadata : undefined
    };
};

// Normalize one inbound or outbound runtime message into the shared channel envelope
export const normalizeRuntimeMessage = message => {
    // Validate the input message envelope
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
        throw new Error('Runtime message must be an object.');
    }

    // Normalize the shared core fields used by every channel adapter
    const sessionId = normalizeSessionId(message.sessionId || message.sessionKey);
    const role = typeof message.role === 'string' && message.role ? message.role : 'user';
    const content = typeof message.content === 'string' ? message.content : '';

    // Return one normalized runtime message shape that adapters can rely on
    return {
        sessionId,
        sessionKey: sessionId,
        role,
        content,
        replyToId: message.replyToId ?? null,
        metadata: message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata) ? message.metadata : undefined,
        timedOut: Boolean(message.timedOut),
        error: message.error ?? undefined,
        file: normalizeRuntimeFile(message.file)
    };
};