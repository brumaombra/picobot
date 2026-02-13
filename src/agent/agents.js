import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { AGENTS_DIR } from '../config.js';
import { logger } from '../utils/logger.js';

// In-memory map of loaded agent definitions
let agents = new Map();

// Parse YAML-like frontmatter from markdown content
export const parseFrontmatter = content => {
    // Match frontmatter block at the start of the content
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { metadata: {}, body: content };

    // Parse the frontmatter content into a metadata object
    const rawMeta = match[1];
    const body = content.slice(match[0].length).trim();
    const metadata = {};
    let currentKey = null;
    let currentList = null;

    // Process each line of the frontmatter
    for (const line of rawMeta.split(/\r?\n/)) {
        const listItem = line.match(/^\s+-\s+(.+)$/);
        const keyValue = line.match(/^([\w_]+):\s*(.*)$/);

        // Handle list items
        if (listItem && currentKey) {
            currentList.push(listItem[1].trim());
        } else if (keyValue) {
            // Flush previous list key
            if (currentKey && currentList) {
                metadata[currentKey] = currentList;
            }

            // Start new key
            currentKey = keyValue[1];
            const value = keyValue[2].trim();

            // If value is empty, expect a list to follow
            if (value) {
                metadata[currentKey] = value;
                currentKey = null;
                currentList = null;
            } else {
                currentList = [];
            }
        }
    }

    // Flush final key
    if (currentKey && currentList) {
        metadata[currentKey] = currentList;
    }

    // Return the parsed metadata and the remaining body content
    return { metadata, body };
};

// Load all agent definitions from the agents directory
export const loadAgents = () => {
    // Create a new map to store loaded agents
    agents = new Map();

    // Check if agents directory exists
    if (!existsSync(AGENTS_DIR)) {
        logger.warn(`Agents directory not found: ${AGENTS_DIR}`);
        return agents;
    }

    try {
        // Read all markdown files in the agents directory
        const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));

        // Process each agent file
        for (const file of files) {
            // Read file content and parse frontmatter
            const filePath = join(AGENTS_DIR, file);
            const content = readFileSync(filePath, 'utf-8');
            const { metadata, body } = parseFrontmatter(content);

            // Create agent definition from metadata and body content
            const agent = {
                id: basename(file, '.md'),
                name: metadata.name || basename(file, '.md'),
                description: metadata.description || '',
                allowedTools: metadata.allowed_tools || [],
                instructions: body.trim()
            };

            // Store agent definition in the map
            agents.set(agent.id, agent);
            logger.info(`Loaded agent: ${agent.name} (${agent.id})`);
        }

        // Log total count of loaded agents
        logger.info(`Loaded ${agents.size} agent(s) from ${AGENTS_DIR}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to load agents: ${message}`);
    }

    // Return the map of loaded agents
    return agents;
};

// Get all loaded agents
export const getAgents = () => {
    return agents;
};

// Get a specific agent by ID
export const getAgent = id => {
    return agents.get(id);
};

// Get a list of all loaded agent IDs (for use as enum values)
export const getAgentIds = () => {
    return [...agents.keys()];
};

// Generate a formatted list of available agents for prompt injection
export const generateAgentsList = () => {
    if (agents.size === 0) return 'No specialized agents available.';
    const lines = [];
    for (const [id, agent] of agents) {
        // Create the list of allowed tools for each agent
        const tools = agent.allowedTools.join(', ');

        // Format each agent as a markdown list item with name, description, and allowed tools
        lines.push(`- **${agent.name}** (\`${id}\`): ${agent.description} Tools: \`${tools}\``);
    }

    // Return the formatted list as a string
    return lines.join('\n');
};