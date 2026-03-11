import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { SKILLS_FILE_NAME, SUBAGENTS_FILE_NAME, SUBAGENT_FILE_NAME, TOOLS_FILE_NAME } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROMPTS_DIR = join(__dirname, '../files/default-prompts');

// Read a bundled default prompt template file from the framework
const readDefaultPromptTemplate = fileName => {
    return readFileSync(join(DEFAULT_PROMPTS_DIR, fileName), 'utf-8').trim();
};

// Ensure the application prompts directory exists and contains all default prompt files
const ensurePromptTemplatesInDirectory = ({ promptsDir }) => {
    // Create the prompts directory when it does not exist yet
    if (!existsSync(promptsDir)) {
        mkdirSync(promptsDir, { recursive: true });
    }

    // Create the list of prompts files
    const promptFiles = [SUBAGENTS_FILE_NAME, TOOLS_FILE_NAME, SKILLS_FILE_NAME, SUBAGENT_FILE_NAME];

    // Create each missing prompt file from the bundled defaults
    for (const fileName of promptFiles) {
        const filePath = join(promptsDir, fileName);
        if (!existsSync(filePath)) {
            writeFileSync(filePath, `${readDefaultPromptTemplate(fileName)}\n`);
        }
    }
};

// Read a prompt template file from the prompts directory
const readPromptTemplate = ({ promptsDir, fileName }) => {
    // Check if the prompt file exists
    const filePath = join(promptsDir, fileName);
    if (!existsSync(filePath)) {
        return '';
    }

    // Read and return the prompt template content
    const fileContent = readFileSync(filePath, 'utf-8').trim();
    return fileContent;
};

// Validate that prompt templates contain the placeholders required by the framework
const validatePromptTemplates = promptTemplates => {
    // Define the required placeholders for each prompt template
    const requiredPlaceholders = [{
        templateKey: 'subagents',
        fileName: SUBAGENTS_FILE_NAME,
        placeholder: '{subagentsList}'
    }, {
        templateKey: 'tools',
        fileName: TOOLS_FILE_NAME,
        placeholder: '{toolsList}'
    }, {
        templateKey: 'skills',
        fileName: SKILLS_FILE_NAME,
        placeholder: '{skillsList}'
    }];

    // Check that each required placeholder is present
    for (const requirement of requiredPlaceholders) {
        const template = promptTemplates[requirement.templateKey] || '';
        if (!template.includes(requirement.placeholder)) {
            throw new Error(`Prompt file "${requirement.fileName}" must include the placeholder ${requirement.placeholder}.`);
        }
    }
};

// Load prompt templates from the specified directory
export const loadPromptTemplatesFromDirectory = ({ promptsDir } = {}) => {
    // Validate the prompts directory path
    if (!promptsDir) {
        throw new Error('promptsDir is required.');
    }

    // Ensure the prompts directory and default prompt files exist
    ensurePromptTemplatesInDirectory({ promptsDir });

    // Load each supported prompt template file
    const promptTemplates = {
        subagents: readPromptTemplate({ promptsDir, fileName: SUBAGENTS_FILE_NAME }),
        tools: readPromptTemplate({ promptsDir, fileName: TOOLS_FILE_NAME }),
        skills: readPromptTemplate({ promptsDir, fileName: SKILLS_FILE_NAME }),
        subagent: readPromptTemplate({ promptsDir, fileName: SUBAGENT_FILE_NAME })
    };

    // Validate the templates required by the framework prompt composer
    validatePromptTemplates(promptTemplates);

    // Return the valid prompt templates
    return promptTemplates;
};