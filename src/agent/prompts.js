import { readFileSync, existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { PROMPT_DIR, AGENTS_PATH, SOUL_PATH } from '../config.js';
import { getFormattedAgentTypesList, getFormattedModelTiersList } from '../utils/utils.js';

// Build the system prompt
export const buildSystemPrompt = () => {
    const prompts = [];

    // Load AGENTS.md
    const agentsPrompt = getAgentsPrompt();
    if (!agentsPrompt) {
        throw new Error(`AGENTS.md is required in prompt directory: ${PROMPT_DIR}`);
    } else {
        prompts.push(agentsPrompt);
    }

    // Load SOUL.md
    const soulPrompt = getSoulPrompt();
    if (soulPrompt) {
        prompts.push(soulPrompt);
    }

    // Return the combined prompt
    return prompts.join('\n\n');
};

// Get the AGENTS.md prompt content
export const getAgentsPrompt = () => {
    // Check if AGENTS.md exists
    if (!existsSync(AGENTS_PATH)) {
        logger.debug('AGENTS.md not found, skipping');
        return '';
    }

    try {
        const agentsContent = readFileSync(AGENTS_PATH, 'utf-8');
        logger.debug('Loaded AGENTS.md');
        return agentsContent;
    } catch (error) {
        logger.warn(`Failed to load AGENTS.md: ${error}`);
        return '';
    }
};

// Get the SOUL.md prompt content
export const getSoulPrompt = () => {
    // Check if SOUL.md exists
    if (!existsSync(SOUL_PATH)) {
        logger.debug('SOUL.md not found, skipping');
        return '';
    }

    try {
        const soulContent = readFileSync(SOUL_PATH, 'utf-8');
        logger.debug('Loaded SOUL.md');
        return soulContent;
    } catch (error) {
        logger.warn(`Failed to load SOUL.md: ${error}`);
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