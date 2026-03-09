export const parseFrontmatter = content => {
    const source = String(content || '');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!match) {
        return { metadata: {}, body: source.trim() };
    }

    const metadata = {};
    const rawMetadata = match[1];
    const body = source.slice(match[0].length).trim();
    let currentKey = null;
    let currentList = null;

    for (const rawLine of rawMetadata.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        const listItem = line.match(/^\s+-\s+(.+)$/);
        const keyValue = line.match(/^([\w_]+):\s*(.*)$/);

        if (listItem && currentKey) {
            currentList.push(listItem[1].trim());
            continue;
        }

        if (!keyValue) {
            continue;
        }

        if (currentKey && currentList) {
            metadata[currentKey] = currentList;
        }

        currentKey = keyValue[1];
        const value = keyValue[2].trim();

        if (value) {
            metadata[currentKey] = value;
            currentKey = null;
            currentList = null;
            continue;
        }

        currentList = [];
    }

    if (currentKey && currentList) {
        metadata[currentKey] = currentList;
    }

    return { metadata, body };
};