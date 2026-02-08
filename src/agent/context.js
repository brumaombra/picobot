import { readFileSync, existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { PROMPT_DIR, AGENTS_PATH, SOUL_PATH, USER_PATH } from '../config.js';

// Build the system prompt
export const buildSystemPrompt = ({ loadAgentProfile, loadUserProfile }) => {
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

    // Try to load SOUL.md if it exists and loading is enabled
    if (loadAgentProfile) {
        if (existsSync(SOUL_PATH)) {
            try {
                const soulContent = readFileSync(SOUL_PATH, 'utf-8');
                prompt += `\n\n${soulContent}`;
                logger.debug('Loaded SOUL.md');
            } catch (error) {
                logger.warn(`Failed to load SOUL.md: ${error}`);
            }
        }
    } else {
        logger.debug('Skipping SOUL.md (loadAgentProfile disabled)');
    }

    // Try to load USER.md if it exists and loading is enabled
    if (loadUserProfile) {
        if (existsSync(USER_PATH)) {
            try {
                const userContent = readFileSync(USER_PATH, 'utf-8');
                prompt += `\n\n${userContent}`;
                logger.debug('Loaded USER.md');
            } catch (error) {
                logger.warn(`Failed to load USER.md: ${error}`);
            }
        }
    } else {
        logger.debug('Skipping USER.md (loadUserProfile disabled)');
    }

    // Return the final prompt
    return prompt;
};