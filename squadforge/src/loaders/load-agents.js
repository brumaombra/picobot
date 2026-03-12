import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { AgentSpec } from '../core/agent-spec.js';
import { LEADER_FILE_NAME, LEADER_SPEC_ID, MARKDOWN_EXTENSION } from '../config.js';
import { isMarkdownFile, parseFrontmatter } from '../utils/utils.js';
import { createPredefinedToolList } from '../tools/tools-catalog.js';

// Validate that the allowed tools frontmatter is a list of non-empty strings
const validateAllowedToolsStructure = ({ agentId, allowedTools }) => {
    // Validate that allowedTools is an array
    if (!Array.isArray(allowedTools)) {
        throw new Error(`Agent "${agentId}" has invalid allowed_tools. Expected a list of strings.`);
    }

    // Validate that each entry in allowedTools is a non-empty string
    const hasInvalidToolName = allowedTools.some(toolName => typeof toolName !== 'string' || !toolName.trim());
    if (hasInvalidToolName) {
        throw new Error(`Agent "${agentId}" has invalid allowed_tools. Each entry must be a non-empty string.`);
    }
};

// Validate that all tools referenced in the agent spec are available
const validateAllowedTools = ({ agentId, allowedTools, availableTools = null }) => {
    // If no tools are referenced, skip validation
    if (allowedTools.length === 0) {
        return;
    }

    // Throw if tools are required but were not provided for validation
    if (!availableTools) {
        throw new Error(`Agent "${agentId}" references tools but no available tools were provided for validation.`);
    }

    // Throw if any referenced tools are missing
    const unknownTools = allowedTools.filter(toolName => !availableTools.has(toolName));
    if (unknownTools.length > 0) {
        throw new Error(`Agent "${agentId}" references unknown tools: ${unknownTools.join(', ')}`);
    }
};

// Read and parse an agent spec from a markdown file
const readAgentSpec = ({ filePath, availableTools, hasSubagents }) => {
    // Read the file content and parse the frontmatter
    const fileName = basename(filePath);
    const content = readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);
    const id = basename(fileName, MARKDOWN_EXTENSION);
    const externalToolNames = metadata.allowed_tools || [];

    // Validate the allowed tools structure before constructing the spec
    validateAllowedToolsStructure({ agentId: id, allowedTools: externalToolNames });

    // Combine the predefined tools with the external tools
    const predefinedToolNames = createPredefinedToolList({ agentId: id, hasSubagents });
    const allowedTools = [...new Set([...predefinedToolNames, ...externalToolNames])];

    // Create the agent spec object
    const agentSpec = new AgentSpec({
        id,
        name: metadata.name || id,
        description: metadata.description || '',
        model: metadata.model || null,
        allowedTools,
        prompt: body,
        filePath,
        metadata
    });

    // Validate that all referenced tools are available
    validateAllowedTools({ agentId: id, allowedTools, availableTools });

    // Return the agent spec
    return agentSpec;
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
    const files = readdirSync(agentsDir).filter(isMarkdownFile);
    const hasSubagents = files.some(fileName => basename(fileName, MARKDOWN_EXTENSION) !== LEADER_SPEC_ID);

    // Load each agent spec and store it in a map by id
    const agentsSpecs = new Map();
    for (const fileName of files) {
        const filePath = join(agentsDir, fileName);
        const agentSpec = readAgentSpec({ filePath, availableTools, hasSubagents });
        agentsSpecs.set(agentSpec.id, agentSpec);
    }

    // Ensure we have a leader agent spec
    if (!agentsSpecs.has(LEADER_SPEC_ID)) {
        throw new Error(`Leader agent file not found: ${join(agentsDir, LEADER_FILE_NAME)}`);
    }

    // Return the map of agent specs
    return agentsSpecs;
};