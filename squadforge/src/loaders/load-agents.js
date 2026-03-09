import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { AgentDefinition, MAIN_AGENT_KIND, SUBAGENT_KIND } from '../core/agent-definition.js';
import { parseFrontmatter } from '../utils/frontmatter.js';

const MARKDOWN_EXTENSION = '.md';
const MAIN_FILE_NAME = 'main.md';

const isMarkdownFile = fileName => fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION);

const readAgentDefinition = (filePath, kind) => {
    const fileName = basename(filePath);
    const content = readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);
    const id = kind === MAIN_AGENT_KIND ? 'main' : basename(fileName, MARKDOWN_EXTENSION);

    return new AgentDefinition({
        id,
        kind,
        name: metadata.name || id,
        description: metadata.description || '',
        model: metadata.model || null,
        allowedTools: metadata.allowed_tools || [],
        prompt: body,
        filePath,
        metadata
    });
};

export const loadAgentsFromDirectory = agentsDir => {
    if (!agentsDir) {
        throw new Error('agentsDir is required.');
    }

    if (!existsSync(agentsDir)) {
        throw new Error(`Agents directory not found: ${agentsDir}`);
    }

    const files = readdirSync(agentsDir)
        .filter(isMarkdownFile)
        .sort((left, right) => left.localeCompare(right));

    const mainFilePath = join(agentsDir, MAIN_FILE_NAME);
    if (!existsSync(mainFilePath)) {
        throw new Error(`Main agent file not found: ${mainFilePath}`);
    }

    const mainAgent = readAgentDefinition(mainFilePath, MAIN_AGENT_KIND);
    const subagents = new Map();

    for (const fileName of files) {
        if (fileName.toLowerCase() === MAIN_FILE_NAME) {
            continue;
        }

        const filePath = join(agentsDir, fileName);
        const definition = readAgentDefinition(filePath, SUBAGENT_KIND);
        subagents.set(definition.id, definition);
    }

    return {
        mainAgent,
        subagents
    };
};
