import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, join } from 'path';

// Load persisted sessions from the specified directory
export const loadSessionsFromDirectory = ({ sessionsDir } = {}) => {
    // Validate the sessions directory path
    if (!sessionsDir) {
        throw new Error('sessionsDir is required.');
    }

    // Return an empty store when the sessions directory does not exist yet
    if (!existsSync(sessionsDir)) {
        return new Map();
    }

    // Read all JSON session files in a stable order
    const files = readdirSync(sessionsDir)
        .filter(fileName => fileName.endsWith('.json'))
        .sort((left, right) => left.localeCompare(right));

    // Create the sessions map
    const sessions = new Map();

    // Load each persisted session into memory
    for (const fileName of files) {
        // Read the file
        const filePath = join(sessionsDir, fileName);
        const content = readFileSync(filePath, 'utf-8');
        const sessionData = JSON.parse(content);
        const sessionId = sessionData.id || basename(fileName, '.json');

        // Hydrate the session data and store it in the map by id
        sessions.set(sessionId, {
            ...sessionData,
            id: sessionId,
            createdAt: sessionData.createdAt ? new Date(sessionData.createdAt) : new Date(),
            updatedAt: sessionData.updatedAt ? new Date(sessionData.updatedAt) : new Date(),
            messages: Array.isArray(sessionData.messages) ? sessionData.messages : []
        });
    }

    // Return the hydrated session map
    return sessions;
};