import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadAgents, getAgents } from '../../agent/agents.js';
import { loadSkills } from '../../agent/skills.js';
import { buildSystemPrompt, buildSubagentSystemPrompt } from '../../agent/prompts.js';
import { header, success, basicLog } from '../../utils/print.js';
import { initLogger } from '../../utils/logger.js';
import { CONFIG_DIR } from '../../config.js';

// Register the prompts command
export const registerPromptsCommand = ({ program }) => {
    program
        .command('prompts')
        .description('Export all rendered system prompts to a markdown file')
        .action(() => {
            header('📝  Exporting system prompts...');

            // Initialize logger (required by agents/prompts modules)
            initLogger();

            // Load agent definitions (required before building prompts)
            loadAgents();

            // Load skill definitions (required before building main agent prompt)
            loadSkills();

            const sections = [];

            // Build main agent system prompt
            const mainPrompt = buildSystemPrompt();
            sections.push('# Main Agent System Prompt\n\n' + mainPrompt);

            // Build each subagent system prompt
            const agents = getAgents();
            for (const [id, agentDef] of agents) {
                const subPrompt = buildSubagentSystemPrompt(agentDef);
                sections.push(`# Subagent: ${agentDef.name} (\`${id}\`)\n\n` + subPrompt);
            }

            // Write to file
            const output = sections.join('\n\n---\n\n');
            const outputPath = join(CONFIG_DIR, 'prompts-debug.md');
            writeFileSync(outputPath, output, 'utf-8');

            success(`Prompts exported to ${outputPath}`);
            basicLog(`  Main agent: 1 prompt`);
            basicLog(`  Subagents: ${agents.size} prompt(s)`);
        });
};