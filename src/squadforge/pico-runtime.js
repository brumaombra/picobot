import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, extname, join, relative } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { forge } from '../../squadforge/src/index.js';
import { AGENTS_DIR, CONFIG_DIR, PROMPTS_DIR, SESSIONS_DIR, SKILLS_DIR } from '../config.js';
import { parseFrontmatter } from '../utils/common/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE_TOOLS_DIR = join(__dirname, '..', 'tools');
const COMPAT_ROOT_DIR = join(CONFIG_DIR, 'squadforge-runtime');
const COMPAT_AGENTS_DIR = join(COMPAT_ROOT_DIR, 'agents');
const COMPAT_PROMPTS_DIR = join(COMPAT_ROOT_DIR, 'prompts');
const COMPAT_TOOLS_DIR = join(COMPAT_ROOT_DIR, 'tools');
const COMPAT_SUBAGENTS_PROMPT = '# Available Agents\n\n{subagentsList}\n';
const EXCLUDED_TOOL_FILE_NAMES = new Set([
    'ask_main_agent.js',
    'read_file.js',
    'send_file.js',
    'subagent_chat.js',
    'subagent_list.js',
    'subagent_start.js',
    'tools.js'
]);
const EXCLUDED_TOOL_ROOT_DIRECTORIES = new Set(['cron']);
const EXCLUDED_AGENT_FILE_NAMES = new Set(['leader.md', 'scheduler.md']);

// Ensure a directory exists before writing generated compatibility files into it.
const ensureDirectory = directoryPath => {
    mkdirSync(directoryPath, { recursive: true });
};

// Read one prompt file from the Pico prompt directory.
const readPromptFile = fileName => {
    return readFileSync(join(PROMPTS_DIR, fileName), 'utf-8').trim();
};

// Turn markdown frontmatter data back into the simple YAML subset used by Pico and Squadforge.
const serializeFrontmatter = metadata => {
    const lines = ['---'];

    for (const [key, value] of Object.entries(metadata)) {
        if (Array.isArray(value)) {
            lines.push(`${key}:`);
            for (const entry of value) {
                lines.push(`  - ${entry}`);
            }
            continue;
        }

        if (value !== undefined && value !== null && value !== '') {
            lines.push(`${key}: ${value}`);
        }
    }

    lines.push('---');
    return lines.join('\n');
};

// Remove the old injected available-agents section because Squadforge now renders it separately.
const stripAvailableAgentsSection = body => {
    return body
        .replace(/\r\n/g, '\n')
        .replace(/\n#{1,6}\s+Available Agents\s*\n[\s\S]*?\{agentsList\}\s*/i, '\n')
        .trim();
};

// Recursively collect Pico tool source files that should be exposed through Squadforge.
const collectToolSourceFiles = directoryPath => {
    const entries = readdirSync(directoryPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
    const filePaths = [];

    for (const entry of entries) {
        const fullPath = join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            filePaths.push(...collectToolSourceFiles(fullPath));
            continue;
        }

        if (extname(entry.name).toLowerCase() === '.js') {
            filePaths.push(fullPath);
        }
    }

    return filePaths;
};

// Generate a tiny wrapper that re-exports the first tool-shaped export from a Pico tool module.
const createToolWrapperContent = sourcePath => {
    const moduleUrl = pathToFileURL(sourcePath).href;

    return [
        `import * as sourceModule from ${JSON.stringify(moduleUrl)};`,
        '',
        'const tool = sourceModule.default || sourceModule.tool || Object.values(sourceModule).find(value => {',
        "    return value && typeof value === 'object' && typeof value.name === 'string' && typeof value.execute === 'function';",
        '});',
        '',
        'if (!tool) {',
        `    throw new Error(${JSON.stringify(`No tool export found in ${sourcePath}.`)});`,
        '}',
        '',
        'export default tool;',
        ''
    ].join('\n');
};

// Rebuild the generated Squadforge-compatible tool wrappers from Pico's current source tools.
const scaffoldCompatibilityTools = () => {
    rmSync(COMPAT_TOOLS_DIR, { recursive: true, force: true });
    ensureDirectory(COMPAT_TOOLS_DIR);

    for (const sourcePath of collectToolSourceFiles(SOURCE_TOOLS_DIR)) {
        const relativePath = relative(SOURCE_TOOLS_DIR, sourcePath);
        const normalizedRelativePath = relativePath.replace(/\\/g, '/');
        const firstSegment = normalizedRelativePath.split('/')[0];

        if (EXCLUDED_TOOL_ROOT_DIRECTORIES.has(firstSegment)) {
            continue;
        }

        if (EXCLUDED_TOOL_FILE_NAMES.has(normalizedRelativePath.split('/').at(-1))) {
            continue;
        }

        const wrapperPath = join(COMPAT_TOOLS_DIR, relativePath);
        ensureDirectory(dirname(wrapperPath));
        writeFileSync(wrapperPath, createToolWrapperContent(sourcePath));
    }
};

// Rebuild the generated agent specs, keeping Pico's current subagent files and synthesizing the leader.
const scaffoldCompatibilityAgents = () => {
    rmSync(COMPAT_AGENTS_DIR, { recursive: true, force: true });
    ensureDirectory(COMPAT_AGENTS_DIR);

    const agentsRaw = readPromptFile('AGENTS.md');
    const soulRaw = existsSync(join(PROMPTS_DIR, 'SOUL.md')) ? readPromptFile('SOUL.md') : '';
    const { metadata, body } = parseFrontmatter(agentsRaw);
    const leaderBody = [stripAvailableAgentsSection(body), soulRaw].filter(Boolean).join('\n\n').trim();
    const leaderContent = `${serializeFrontmatter(metadata)}\n\n${leaderBody}\n`;

    writeFileSync(join(COMPAT_AGENTS_DIR, 'leader.md'), leaderContent);

    const agentFileNames = readdirSync(AGENTS_DIR)
        .filter(fileName => fileName.endsWith('.md'))
        .sort((left, right) => left.localeCompare(right));

    for (const fileName of agentFileNames) {
        if (EXCLUDED_AGENT_FILE_NAMES.has(fileName)) {
            continue;
        }

        const sourcePath = join(AGENTS_DIR, fileName);
        const targetPath = join(COMPAT_AGENTS_DIR, fileName);
        writeFileSync(targetPath, readFileSync(sourcePath, 'utf-8'));
    }
};

// Rebuild the prompt templates Squadforge expects while preserving Pico's current prompt content.
const scaffoldCompatibilityPrompts = () => {
    rmSync(COMPAT_PROMPTS_DIR, { recursive: true, force: true });
    ensureDirectory(COMPAT_PROMPTS_DIR);

    writeFileSync(join(COMPAT_PROMPTS_DIR, 'SUBAGENTS.md'), COMPAT_SUBAGENTS_PROMPT);
    writeFileSync(join(COMPAT_PROMPTS_DIR, 'TOOLS.md'), `${readPromptFile('TOOLS.md')}\n`);
    writeFileSync(join(COMPAT_PROMPTS_DIR, 'SKILLS.md'), `${readPromptFile('SKILLS.md')}\n`);
    writeFileSync(join(COMPAT_PROMPTS_DIR, 'SUBAGENT.md'), `${readPromptFile('SUBAGENT.md')}\n`);
};

// Build the generated Squadforge compatibility layer that lets Pico boot without a file-layout migration.
export const scaffoldPicoSquadforgeApp = () => {
    ensureDirectory(COMPAT_ROOT_DIR);
    scaffoldCompatibilityPrompts();
    scaffoldCompatibilityAgents();
    scaffoldCompatibilityTools();

    return {
        rootDir: COMPAT_ROOT_DIR,
        agentsDir: COMPAT_AGENTS_DIR,
        promptsDir: COMPAT_PROMPTS_DIR,
        toolsDir: COMPAT_TOOLS_DIR
    };
};

// Create the Squadforge leader agent configured to run Pico's existing prompts, skills, sessions, and tools.
export const createPicoSquadforgeLeader = async ({ llm, model, workspacePath }) => {
    const compatibilityApp = scaffoldPicoSquadforgeApp();

    return forge({
        rootDir: workspacePath,
        agentsDir: compatibilityApp.agentsDir,
        promptsDir: compatibilityApp.promptsDir,
        skillsDir: SKILLS_DIR,
        toolsDir: compatibilityApp.toolsDir,
        sessionsDir: SESSIONS_DIR,
        llm,
        model
    });
};