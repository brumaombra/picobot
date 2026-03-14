import { randomUUID } from 'crypto';
import { DEFAULT_LEADER_SESSION_ID, LEADER_SPEC_ID, MARKDOWN_EXTENSION } from '../config.js';

// Check if the file is a markdown file based on its extension
export const isMarkdownFile = fileName => {
    return fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION);
};

// Generate a unique ID using a prefix and the current timestamp
export const generateId = (prefix = 'id') => {
    return `${prefix}_${randomUUID()}`;
};

// Normalize a session id, defaulting to the leader session when missing
export const normalizeSessionId = sessionId => {
    return sessionId || DEFAULT_LEADER_SESSION_ID;
};

// Check whether an agent definition id refers to the leader
export const isLeaderAgent = agentId => {
    return agentId === LEADER_SPEC_ID;
};

// Resolve the framework role for an agent definition id
export const getAgentRole = agentId => {
    return isLeaderAgent(agentId) ? 'leader' : 'subagent';
};

// Pause execution for the specified number of milliseconds
export const delay = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Stringify a JSON object
export const stringifyJson = value => {
    // If the value is already a string, return it as is
    if (typeof value === 'string') {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

// Parse a JSON string into an object
export const parseJson = rawValue => {
    // If the raw value is falsy, return an empty object
    if (!rawValue) {
        return {};
    }

    // If the raw value is already an object, return it as is
    if (typeof rawValue === 'string') {
        // If the trimmed raw value is empty, return an empty object
        const trimmed = rawValue.trim();
        if (!trimmed) {
            return {};
        }

        // Parse the JSON string
        return JSON.parse(trimmed);
    }

    // If the raw value is already an object, return it as is
    if (typeof rawValue === 'object') {
        return rawValue;
    }

    // For any other type of value, return an empty object
    return {};
};

// Parse the frontmatter from a markdown file
export const parseFrontmatter = content => {
    const source = content || '';
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    // If no frontmatter is found, return an empty metadata object
    if (!match) {
        return { metadata: {}, body: source.trim() };
    }

    const metadata = {};
    const rawMetadata = match[1];
    const body = source.slice(match[0].length).trim();
    let currentKey = null;
    let currentList = null;

    // Parse the frontmatter line by line
    for (const rawLine of rawMetadata.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        const listItem = line.match(/^\s+-\s+(.+)$/);
        const keyValue = line.match(/^([\w_]+):\s*(.*)$/);

        // If the line is a list item and we have a current key, add it to the current list
        if (listItem && currentKey) {
            currentList.push(listItem[1].trim());
            continue;
        }

        // If the line is not a list item and not a key-value pair, skip it
        if (!keyValue) {
            continue;
        }

        // If we have a current key and list, save it to the metadata before moving on to the next key
        if (currentKey && currentList) {
            metadata[currentKey] = currentList;
        }

        // Start a new key-value pair
        currentKey = keyValue[1];
        const value = keyValue[2].trim();

        // If the value is not empty, save it to the metadata and reset the current key and list
        if (value) {
            metadata[currentKey] = value;
            currentKey = null;
            currentList = null;
            continue;
        }

        // If the value is empty, we expect a list to follow, so we initialize the current list
        currentList = [];
    }

    // After processing all lines, if we have a current key and list, save it to the metadata
    if (currentKey && currentList) {
        metadata[currentKey] = currentList;
    }

    // Return the parsed metadata and body
    return { metadata, body };
};