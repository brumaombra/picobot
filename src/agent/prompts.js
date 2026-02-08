import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { PROMPTS_DIR } from '../config.js';
import { getFormattedAgentTypesList, getFormattedModelTiersList } from '../utils/utils.js';

// Build the system prompt
export const buildSystemPrompt = () => {
    const prompts = [];

    // Load AGENTS.md
    const agentsPrompt = getPromptContent('AGENTS.md');
    if (!agentsPrompt) {
        throw new Error(`AGENTS.md is required in prompts directory: ${PROMPTS_DIR}`);
    } else {
        prompts.push(agentsPrompt);
    }

    // Load SOUL.md
    const soulPrompt = getPromptContent('SOUL.md');
    if (soulPrompt) {
        prompts.push(soulPrompt);
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

// Get the agent type tool parameter guidance prompt
export const getAgentTypeParameterPrompt = () => {
    return `
Choose agent type based on task domain:
${getFormattedAgentTypesList()}

Choose specialized agents when tasks are clearly scoped to that domain.`;
};

// Get the model tier tool parameter guidance prompt
export const getModelTierParameterPrompt = () => {
    return `
Choose model tier based on task complexity and speed requirements:
${getFormattedModelTiersList()}

Use higher tiers for tasks requiring deep analysis, creativity, or precision.`;
};