import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { forge } from '../../squadforge/src/index.js';
import { SESSIONS_DIR } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPOSITORY_ROOT_DIR = join(__dirname, '..', '..');
const APP_ROOT_DIR = join(REPOSITORY_ROOT_DIR, 'app');
const APP_AGENTS_DIR = join(APP_ROOT_DIR, 'agents');
const APP_PROMPTS_DIR = join(APP_ROOT_DIR, 'prompts');
const APP_SKILLS_DIR = join(APP_ROOT_DIR, 'skills');
const SOURCE_TOOLS_DIR = join(REPOSITORY_ROOT_DIR, 'src', 'tools');

// Resolve the committed Pico app directories used by Squadforge.
export const getPicoAppPaths = () => {
    return {
        rootDir: APP_ROOT_DIR,
        agentsDir: APP_AGENTS_DIR,
        promptsDir: APP_PROMPTS_DIR,
        skillsDir: APP_SKILLS_DIR,
        toolsDir: SOURCE_TOOLS_DIR
    };
};

// Create the Squadforge leader agent configured to run Pico's committed app content.
export const createPicoSquadforgeLeader = async ({ llm, model, workspacePath }) => {
    const picoApp = getPicoAppPaths();

    return forge({
        rootDir: workspacePath,
        agentsDir: picoApp.agentsDir,
        promptsDir: picoApp.promptsDir,
        skillsDir: picoApp.skillsDir,
        // Tool implementations are still finishing their move into app/, so keep the stable src/tools tree active for now.
        toolsDir: picoApp.toolsDir,
        sessionsDir: SESSIONS_DIR,
        llm,
        model
    });
};