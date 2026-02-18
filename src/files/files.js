import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_PATH, CONFIG_DIR, WORKSPACE_DIR, PROMPTS_DIR, AGENTS_DIR, SKILLS_DIR, SESSIONS_DIR, CRONS_DIR, LOGS_DIR } from '../config.js';
import { success, warning, error, newline } from '../utils/print.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration files and directories to check and create
const CONFIG_ITEMS = [
    { path: CONFIG_DIR, type: 'directory', name: 'Config directory' },
    { path: WORKSPACE_DIR, type: 'directory', name: 'Workspace directory' },
    { path: PROMPTS_DIR, type: 'directory', name: 'Prompts directory' },
    { path: AGENTS_DIR, type: 'directory', name: 'Agents directory' },
    { path: SKILLS_DIR, type: 'directory', name: 'Skills directory' },
    { path: SESSIONS_DIR, type: 'directory', name: 'Sessions directory' },
    { path: CRONS_DIR, type: 'directory', name: 'Crons directory' },
    { path: LOGS_DIR, type: 'directory', name: 'Logs directory' },
    { path: join(PROMPTS_DIR, 'AGENTS.md'), type: 'file', name: 'AGENTS.md', source: join(__dirname, 'examples/AGENTS.md') },
    { path: join(PROMPTS_DIR, 'SOUL.md'), type: 'file', name: 'SOUL.md', source: join(__dirname, 'examples/SOUL.md') },
    { path: join(PROMPTS_DIR, 'TOOLS.md'), type: 'file', name: 'TOOLS.md', source: join(__dirname, 'examples/TOOLS.md') },
    { path: join(PROMPTS_DIR, 'SKILLS.md'), type: 'file', name: 'SKILLS.md', source: join(__dirname, 'examples/SKILLS.md') },
    { path: join(PROMPTS_DIR, 'SUBAGENT.md'), type: 'file', name: 'SUBAGENT.md', source: join(__dirname, 'examples/SUBAGENT.md') },
    { path: CONFIG_PATH, type: 'file', name: 'Config file', source: join(__dirname, 'examples/config.json') }
];

// Check if all required config files and directories exist
export const checkIfConfigFilesExist = () => {
    // Check each config item and log results
    const missing = CONFIG_ITEMS.filter(item => {
        const exists = existsSync(item.path);
        exists ? success(`${item.name} exists (${item.path})`) : error(`${item.name} does not exist (${item.path})`);
        return !exists;
    });

    // If any are missing, log a warning
    if (missing.length > 0) {
        newline();
        warning('One or more configuration files or directories are missing. Please run `picobot onboard` to set up Picobot.');
    }

    // Return true if all exist, false if any are missing
    newline();
    return missing.length === 0;
};

// Create missing config files and directories with default content
export const createConfigFiles = () => {
    CONFIG_ITEMS.forEach(item => {
        // Check if item already exists
        const exists = existsSync(item.path);

        // Create directories or files
        if (item.type === 'directory') {
            if (!exists) mkdirSync(item.path, { recursive: true });
        } else if (item.source && !exists) {
            writeFileSync(item.path, readFileSync(item.source, 'utf-8'));
        }

        // Log results
        success(exists ? `${item.name} already exists (${item.path})` : `Created ${item.name} (${item.path})`);
    });

    // Copy example agent files to agents directory
    copyExampleAgents();

    // Copy example skill files to skills directory
    copyExampleSkills();
};

// Copy example skill folders from examples/skills/ to the skills directory
const copyExampleSkills = () => {
    const examplesDir = join(__dirname, 'examples/skills');
    if (!existsSync(examplesDir)) return;

    try {
        // Read all subdirectories in the examples skills directory
        const entries = readdirSync(examplesDir, { withFileTypes: true });

        // Copy each skill folder to the skills directory if it doesn't already exist
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            // Construct expected paths
            const skillId = entry.name;
            const srcSkillFile = join(examplesDir, skillId, 'SKILL.md');
            const destSkillDir = join(SKILLS_DIR, skillId);
            const destSkillFile = join(destSkillDir, 'SKILL.md');

            // Skip if source SKILL.md does not exist
            if (!existsSync(srcSkillFile)) continue;

            // Create skill folder if needed
            if (!existsSync(destSkillDir)) {
                mkdirSync(destSkillDir, { recursive: true });
            }

            // Copy SKILL.md if destination does not exist
            if (!existsSync(destSkillFile)) {
                writeFileSync(destSkillFile, readFileSync(srcSkillFile, 'utf-8'));
                success(`Created skill: ${skillId}/SKILL.md (${destSkillFile})`);
            } else {
                success(`Skill already exists: ${skillId}/SKILL.md (${destSkillFile})`);
            }
        }
    } catch (error) {
        error(`Failed to copy example skills: ${error}`);
    }
};

// Copy example agent markdown files from examples/agents/ to the agents directory
const copyExampleAgents = () => {
    const examplesDir = join(__dirname, 'examples/agents');
    if (!existsSync(examplesDir)) return;

    try {
        // Read all markdown files in the examples agents directory
        const files = readdirSync(examplesDir).filter(f => f.endsWith('.md'));

        // Copy each file to the agents directory if it doesn't already exist
        for (const file of files) {
            const destPath = join(AGENTS_DIR, file);

            // If the destination file doesn't exist, copy it from the examples directory
            if (!existsSync(destPath)) {
                writeFileSync(destPath, readFileSync(join(examplesDir, file), 'utf-8'));
                success(`Created agent file: ${file} (${destPath})`);
            } else {
                success(`Agent file already exists: ${file} (${destPath})`);
            }
        }
    } catch (error) {
        error(`Failed to copy example agents: ${error}`);
    }
};