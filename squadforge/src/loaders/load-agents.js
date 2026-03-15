import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { AgentSpec } from '../core/agent-spec.js';
import { LEADER_FILE_NAME, LEADER_SPEC_ID, MARKDOWN_EXTENSION } from '../config.js';
import { createPredefinedToolList } from './load-tools.js';
import { isMarkdownFile, parseFrontmatter } from '../utils/utils.js';

// Read and parse an agent spec from a markdown file
const readAgentSpec = ({ filePath, availableTools }) => {
    // Read the file content and parse the frontmatter
    const fileName = basename(filePath);
    const content = readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);
    const id = basename(fileName, MARKDOWN_EXTENSION);
    const externalToolNames = metadata.allowed_tools || [];

    // The allowed_tools field must be a list strings
    if (!Array.isArray(externalToolNames)) {
        throw new Error(`Agent "${id}" has invalid allowed_tools. Expected a list of strings.`);
    }

    // Each tool name must be a non-empty string
    if (externalToolNames.some(toolName => typeof toolName !== 'string' || !toolName.trim())) {
        throw new Error(`Agent "${id}" has invalid allowed_tools. Each entry must be a non-empty string.`);
    }

    // Combine the predefined tools with the external tools
    const predefinedToolNames = createPredefinedToolList({ agentId: id });
    const allowedTools = [...new Set([...predefinedToolNames, ...externalToolNames])];

    // If not tools are available, the agent should not reference any tools
    if (allowedTools.length > 0 && !availableTools) {
        throw new Error(`Agent "${id}" references tools but no available tools were provided for validation.`);
    }

    // Validate that all referenced tools are available
    const unknownTools = allowedTools.filter(toolName => !availableTools?.has(toolName));
    if (unknownTools.length > 0) {
        throw new Error(`Agent "${id}" references unknown tools: ${unknownTools.join(', ')}`);
    }

    // Create the agent spec object
    return new AgentSpec({
        id,
        name: metadata.name || id,
        description: metadata.description || '',
        model: metadata.model || null,
        allowedTools,
        prompt: body,
        filePath,
        metadata
    });
};

// Load agent specs from the specified directory
export const loadAgentsFromDirectory = ({ agentsDir, availableTools = null } = {}) => {
    // Validate the agents directory
    if (!agentsDir) {
        throw new Error('agentsDir is required.');
    }

    // Check if the agents directory exists
    if (!existsSync(agentsDir)) {
        throw new Error(`Agents directory not found: ${agentsDir}`);
    }

    // Find all markdown files in the agents directory
    const files = readdirSync(agentsDir)
        .filter(isMarkdownFile)
        .sort((left, right) => left.localeCompare(right));

    // Require at least one non-leader agent file
    const hasSubagents = files.some(fileName => basename(fileName, MARKDOWN_EXTENSION) !== LEADER_SPEC_ID);
    if (!hasSubagents) {
        throw new Error(`Agents directory must contain at least one subagent file in addition to ${LEADER_FILE_NAME}.`);
    }

    // Load each agent spec and store it in a map by id
    const agentsSpecs = new Map();
    for (const fileName of files) {
        const filePath = join(agentsDir, fileName);
        const agentSpec = readAgentSpec({ filePath, availableTools });
        agentsSpecs.set(agentSpec.id, agentSpec);
    }

    // Ensure we have a leader agent spec
    if (!agentsSpecs.has(LEADER_SPEC_ID)) {
        throw new Error(`Leader agent file not found: ${join(agentsDir, LEADER_FILE_NAME)}`);
    }

    // Return the map of agent specs
    return agentsSpecs;
};