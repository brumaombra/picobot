import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { PROMPTS_DIR } from '../config.js';
import { generateToolsList } from '../tools/tools.js';

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

    // Load TOOLS.md and replace {toolsList} placeholder
    let toolsPrompt = getPromptContent('TOOLS.md');
    if (toolsPrompt) {
        const toolsList = generateToolsList(); // Generate and insert tools list
        toolsPrompt = toolsPrompt.replace('{toolsList}', toolsList);
        prompts.push(toolsPrompt);
    }

    // Return the combined prompt
    return prompts.join('\n\n');
};

// Build the subagent system prompt
export const buildSubagentSystemPrompt = () => {
    const prompts = [];

    // Load SUBAGENT.md
    const subagentPrompt = getPromptContent('SUBAGENT.md');
    if (subagentPrompt) {
        prompts.push(subagentPrompt);
    }

    // Load TOOLS.md and replace {toolsList} placeholder
    let toolsPrompt = getPromptContent('TOOLS.md');
    if (toolsPrompt) {
        const toolsList = generateToolsList({
            exclude: ['subagent'] // Exclude subagent tool from subagent prompt
        });
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