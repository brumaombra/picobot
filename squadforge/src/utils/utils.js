import { MARKDOWN_EXTENSION } from '../config.js';

// Check if the file is a markdown file based on its extension
export const isMarkdownFile = fileName => {
    return fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION);
};

// Parse the frontmatter from a markdown file
export const parseFrontmatter = content => {
    const source = String(content || '');
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