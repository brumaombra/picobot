import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { PROMPTS_DIR } from '../config.js';
import { generateToolsList } from '../tools/tools.js';
import { parseFrontmatter, generateAgentsList } from './agents.js';

// Cached main agent metadata (parsed once from AGENTS.md frontmatter)
let mainAgentMeta = null;

// Build the system prompt
export const buildSystemPrompt = () => {
    const prompts = [];

    // Load and parse AGENTS.md
    const agentsRaw = getPromptContent('AGENTS.md');
    if (!agentsRaw) {
        throw new Error(`AGENTS.md is required in prompts directory: ${PROMPTS_DIR}`);
    }

    const { metadata, body } = parseFrontmatter(agentsRaw);
    mainAgentMeta = metadata;

    // Replace {agentsList} placeholder with loaded agents
    let agentsPrompt = body;
    agentsPrompt = agentsPrompt.replace('{agentsList}', generateAgentsList());
    prompts.push(agentsPrompt);

    // Load SOUL.md
    const soulPrompt = getPromptContent('SOUL.md');
    if (soulPrompt) {
        prompts.push(soulPrompt);
    }

    // Load TOOLS.md and replace {toolsList} with main agent's allowed tools
    let toolsPrompt = getPromptContent('TOOLS.md');
    if (toolsPrompt) {
        const allowedTools = metadata.allowed_tools || [];
        const toolsList = generateToolsList(allowedTools);
        toolsPrompt = toolsPrompt.replace('{toolsList}', toolsList);
        prompts.push(toolsPrompt);
    }

    // Return the combined prompt
    return prompts.join('\n\n');
};

// Get the main agent's allowed tool names from AGENTS.md frontmatter
export const getMainAgentAllowedTools = () => {
    // Use cached metadata if available
    if (mainAgentMeta) {
        return mainAgentMeta.allowed_tools || [];
    }

    // Otherwise parse AGENTS.md
    const agentsRaw = getPromptContent('AGENTS.md');
    if (!agentsRaw) return [];

    const { metadata } = parseFrontmatter(agentsRaw);
    mainAgentMeta = metadata;
    return metadata.allowed_tools || [];
};

// Build the subagent system prompt for a specific agent definition
export const buildSubagentSystemPrompt = agentDef => {
    const prompts = [];

    // Load SUBAGENT.md (generic subagent instructions)
    const subagentPrompt = getPromptContent('SUBAGENT.md');
    if (subagentPrompt) {
        prompts.push(subagentPrompt);
    }

    // Add agent-specific instructions from the agent's markdown body
    if (agentDef?.instructions) {
        prompts.push(agentDef.instructions);
    }

    // Load TOOLS.md and replace {toolsList} with agent's allowed tools
    let toolsPrompt = getPromptContent('TOOLS.md');
    if (toolsPrompt) {
        const toolsList = generateToolsList(agentDef?.allowedTools || []);
        toolsPrompt = toolsPrompt.replace('{toolsList}', toolsList);
        prompts.push(toolsPrompt);
    }

    // Return the combined prompt
    return prompts.join('\n\n');
};

// Get prompt content from prompts directory by filename
export const getPromptContent = filename => {
    const filePath = join(PROMPTS_DIR, filename);

    // Check if file exists
    if (!existsSync(filePath)) {
        logger.debug(`${filename} not found in prompts directory, skipping`);
        return '';
    }

    try {
        const content = readFileSync(filePath, 'utf-8');
        logger.debug(`Loaded ${filename}`);
        return content;
    } catch (error) {
        logger.warn(`Failed to load ${filename}: ${error}`);
        return '';
    }
};