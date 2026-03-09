import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { AgentSpec, MAIN_AGENT_KIND, SUBAGENT_KIND } from '../core/agent-spec.js';
import { parseFrontmatter } from '../utils/frontmatter.js';

const MARKDOWN_EXTENSION = '.md';
const MAIN_FILE_NAME = 'main.md';

const isMarkdownFile = fileName => fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION);

const validateAllowedTools = (definition, availableTools) => {
    if (!(availableTools instanceof Map) || definition.allowedTools.length === 0) {
        return;
    }

    const missingTools = definition.allowedTools.filter(toolName => !availableTools.has(toolName));
    if (missingTools.length === 0) {
        return;
    }

    throw new Error(`Agent "${definition.id}" references unknown tools: ${missingTools.join(', ')}`);
};

const readAgentSpec = (filePath, kind, availableTools) => {
    const fileName = basename(filePath);
    const content = readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);
    const id = kind === MAIN_AGENT_KIND ? 'main' : basename(fileName, MARKDOWN_EXTENSION);

    const definition = new AgentSpec({
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

    validateAllowedTools(definition, availableTools);
    return definition;
};

export const loadAgentsFromDirectory = ({ agentsDir, availableTools = null } = {}) => {
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

    const leaderAgent = readAgentSpec(mainFilePath, MAIN_AGENT_KIND, availableTools);
    const subagents = new Map();

    for (const fileName of files) {
        if (fileName.toLowerCase() === MAIN_FILE_NAME) {
            continue;
        }

        const filePath = join(agentsDir, fileName);
        const definition = readAgentSpec(filePath, SUBAGENT_KIND, availableTools);
        subagents.set(definition.id, definition);
    }

    return {
        leaderAgent,
        subagents
    };
};
