import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { AgentSpec, LEADER_AGENT_KIND, SUBAGENT_KIND } from '../core/agent-spec.js';
import { parseFrontmatter } from '../utils/frontmatter.js';

const MARKDOWN_EXTENSION = '.md';
const LEADER_FILE_NAME = 'leader.md';
const LEADER_SPEC_ID = 'leader';

const isMarkdownFile = fileName => fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION);

const validateAllowedTools = (agentSpec, availableTools) => {
    if (agentSpec.allowedTools.length === 0) {
        return;
    }

    const missingTools = agentSpec.allowedTools.filter(toolName => !availableTools.has(toolName));
    if (missingTools.length === 0) {
        return;
    }

    throw new Error(`Agent "${agentSpec.id}" references unknown tools: ${missingTools.join(', ')}`);
};

const readAgentSpec = (filePath, kind, availableTools) => {
    const fileName = basename(filePath);
    const content = readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);
    const id = kind === LEADER_AGENT_KIND ? LEADER_SPEC_ID : basename(fileName, MARKDOWN_EXTENSION);

    const agentSpec = new AgentSpec({
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

    validateAllowedTools(agentSpec, availableTools);
    return agentSpec;
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

    const leaderFilePath = join(agentsDir, LEADER_FILE_NAME);
    if (!existsSync(leaderFilePath)) {
        throw new Error(`Leader agent file not found: ${leaderFilePath}`);
    }

    const agentsSpecs = new Map();
    const leaderSpec = readAgentSpec(leaderFilePath, LEADER_AGENT_KIND, availableTools);
    agentsSpecs.set(leaderSpec.id, leaderSpec);

    for (const fileName of files) {
        if (fileName.toLowerCase() === LEADER_FILE_NAME) {
            continue;
        }

        const filePath = join(agentsDir, fileName);
        const subagentSpec = readAgentSpec(filePath, SUBAGENT_KIND, availableTools);
        agentsSpecs.set(subagentSpec.id, subagentSpec);
    }

    return {
        agentsSpecs
    };
};
