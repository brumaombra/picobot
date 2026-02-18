import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { SKILLS_DIR } from '../config.js';
import { logger } from '../utils/logger.js';
import { parseFrontmatter } from '../utils/utils.js';

// In-memory map of loaded skill definitions
let skills = new Map();

// Load all skill definitions from the skills directory
export const loadSkills = () => {
    // Create a new map to store loaded skills
    skills = new Map();

    // Check if skills directory exists
    if (!existsSync(SKILLS_DIR)) {
        logger.warn(`Skills directory not found: ${SKILLS_DIR}`);
        return skills;
    }

    try {
        // Read all entries in the skills directory (one folder per skill)
        const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });

        // Process each skill folder
        for (const entry of entries) {
            // Skip non-directory entries
            if (!entry.isDirectory()) continue;

            // Construct expected path to SKILL.md file within this skill folder
            const skillId = entry.name;
            const skillFile = join(SKILLS_DIR, skillId, 'SKILL.md');

            // Skip if no SKILL.md file found in this folder
            if (!existsSync(skillFile)) {
                logger.warn(`Skipping skill folder '${skillId}': no SKILL.md found`);
                continue;
            }

            // Read and parse frontmatter from SKILL.md
            const content = readFileSync(skillFile, 'utf-8');
            const { metadata } = parseFrontmatter(content);

            // Create skill definition from metadata
            const skill = {
                id: skillId,
                name: metadata.name || skillId,
                description: metadata.description || '',
                path: skillFile
            };

            // Store skill definition in the map
            skills.set(skillId, skill);
            logger.info(`Loaded skill: ${skill.name} (${skill.id})`);
        }

        // Log total count of loaded skills
        logger.info(`Loaded ${skills.size} skill(s) from ${SKILLS_DIR}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to load skills: ${message}`);
    }

    // Return the map of loaded skills
    return skills;
};

// Get all loaded skills
export const getSkills = () => {
    return skills;
};

// Get a specific skill by ID
export const getSkill = id => {
    return skills.get(id);
};

// Generate a formatted list of available skills for prompt injection
export const generateSkillsListPrompt = () => {
    if (skills.size === 0) return 'No skills available.';

    // Format each skill as a markdown bullet point with name, description, and file path
    const lines = [];
    for (const [, skill] of skills) {
        lines.push(`### ${skill.name}`);
        lines.push(`- **Description**: ${skill.description}`);
        lines.push(`- **Path**: \`${skill.path}\``);
    }

    // Join all lines into a single string
    return lines.join('\n\n');
};