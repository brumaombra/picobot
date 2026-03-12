import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { SKILL_FILE_NAME } from '../config.js';
import { parseFrontmatter } from '../utils/utils.js';

// Load skill definitions from the specified directory
export const loadSkillsFromDirectory = ({ skillsDir } = {}) => {
    // Validate the skills directory path
    if (!skillsDir) {
        throw new Error('skillsDir is required.');
    }

    // Check if the skills directory exists
    if (!existsSync(skillsDir)) {
        return new Map();
    }

    // Read the list of entries
    const skills = new Map();
    const entries = readdirSync(skillsDir, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

    // Load each skill definition
    for (const entry of entries) {
        // Skip non-directory entries
        if (!entry.isDirectory()) {
            continue;
        }

        // Skip entries that do not contain a skill definition file
        const skillFilePath = join(skillsDir, entry.name, SKILL_FILE_NAME);
        if (!existsSync(skillFilePath)) {
            continue;
        }

        // Read the skill file content and parse the frontmatter
        const content = readFileSync(skillFilePath, 'utf-8');
        const { metadata, body } = parseFrontmatter(content);

        // Store the skill definition
        skills.set(entry.name, {
            id: entry.name,
            name: metadata.name || entry.name,
            description: metadata.description || '',
            prompt: body,
            filePath: skillFilePath,
            metadata
        });
    }

    // Return the skills
    return skills;
};