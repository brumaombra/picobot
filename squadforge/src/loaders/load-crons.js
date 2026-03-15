import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Load persisted cron entries from the specified directory
export const loadCronsFromDirectory = ({ cronsDir } = {}) => {
    // Validate the crons directory path
    if (!cronsDir) {
        throw new Error('cronsDir is required.');
    }

    // Return an empty map when the crons directory does not exist yet
    if (!existsSync(cronsDir)) {
        return new Map();
    }

    // Read all cron files in a stable order
    const files = readdirSync(cronsDir)
        .filter(fileName => fileName.endsWith('.json'))
        .sort((left, right) => left.localeCompare(right));

    // Create the cron entries map
    const entries = new Map();

    // Load each persisted cron entry into memory
    for (const fileName of files) {
        // Read and parse the cron entry file
        const filePath = join(cronsDir, fileName);
        const parsedEntry = JSON.parse(readFileSync(filePath, 'utf-8'));
        entries.set(parsedEntry.id, parsedEntry);
    }

    // Return the loaded cron entries
    return entries;
};