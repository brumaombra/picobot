import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { SKILL_FILE_NAME } from '../config.js';
import { parseFrontmatter } from '../utils/utils.js';

// Read and parse a skill definition from a skill directory
const readSkillDefinition = ({ skillsDir, skillDirName }) => {
    // Check if the skill file exists in the skill directory
    const skillFilePath = join(skillsDir, skillDirName, SKILL_FILE_NAME);
    if (!existsSync(skillFilePath)) {
        return null;
    }

    // Read the skill file content and parse the frontmatter
    const content = readFileSync(skillFilePath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);

    // Return the skill definition object
    return {
        id: skillDirName,
        name: metadata.name || skillDirName,
        description: metadata.description || '',
        prompt: body,
        filePath: skillFilePath,
        metadata
    };
};

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

        // Read the skill definition from the skill directory
        const skill = readSkillDefinition({
            skillsDir,
            skillDirName: entry.name
        });

        // Skip entries that do not contain a valid skill definition
        if (!skill) {
            continue;
        }

        // Store the skill definition
        skills.set(skill.id, skill);
    }

    // Return the skills
    return skills;
};