import { readFileSync, existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { PROMPT_DIR, AGENTS_PATH, SOUL_PATH } from '../config.js';

// Build the system prompt
export const buildSystemPrompt = () => {
    let prompt = '';

    // Load AGENTS.md
    if (!existsSync(AGENTS_PATH)) {
        throw new Error(`AGENTS.md is required in prompt directory: ${PROMPT_DIR}`);
    }

    try {
        const agentsContent = readFileSync(AGENTS_PATH, 'utf-8');
        prompt += agentsContent;
        logger.debug('Loaded AGENTS.md');
    } catch (error) {
        logger.warn(`Failed to load AGENTS.md: ${error}`);
    }

    // Load SOUL.md if it exists
    if (existsSync(SOUL_PATH)) {
        try {
            const soulContent = readFileSync(SOUL_PATH, 'utf-8');
            prompt += `\n\n${soulContent}`;
            logger.debug('Loaded SOUL.md');
        } catch (error) {
            logger.warn(`Failed to load SOUL.md: ${error}`);
        }
    }

    // Return the final prompt
    return prompt;
};