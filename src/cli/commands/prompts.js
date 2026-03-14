import { writeFileSync } from 'fs';
import { join } from 'path';
import { Agent } from '../../../squadforge/src/core/agent.js';
import { createPicoSquadforgeLeader } from '../../index.js';
import { loadConfig, validateConfig } from '../../config/config.js';
import { header, success, basicLog } from '../../utils/common/print.js';
import { initLogger } from '../../utils/common/logger.js';
import { CONFIG_DIR } from '../../config.js';

// Register the prompts command
export const registerPromptsCommand = ({ program }) => {
    program
        .command('prompts')
        .description('Export all rendered system prompts to a markdown file')
        .action(async () => {
            header('📝  Exporting system prompts...');

            // Initialize logger before building the Squadforge runtime.
            initLogger();

            const loadedConfig = loadConfig();
            const validatedConfig = loadedConfig ? validateConfig({ config: loadedConfig }) : null;
            const workspacePath = validatedConfig?.workspace || process.cwd();
            const model = validatedConfig?.agent?.model || null;
            const leader = await createPicoSquadforgeLeader({
                llm: null,
                model,
                workspacePath
            });

            const sections = [];

            // Build the leader prompt from the committed app structure.
            sections.push('# Main Agent System Prompt\n\n' + leader.prompt);

            // Build each subagent prompt from the same runtime so export matches real startup behavior.
            const subagentSpecs = [...leader.runtime.agentsSpecs.values()].filter(spec => spec.id !== 'leader');
            for (const spec of subagentSpecs) {
                const subagent = new Agent({
                    runtime: leader.runtime,
                    definition: spec,
                    sessionId: `prompt_export_${spec.id}`
                });
                sections.push(`# Subagent: ${spec.name} (\`${spec.id}\`)\n\n` + subagent.prompt);
            }

            // Write to file
            const output = sections.join('\n\n---\n\n');
            const outputPath = join(CONFIG_DIR, 'prompts-debug.md');
            writeFileSync(outputPath, output, 'utf-8');

            success(`Prompts exported to ${outputPath}`);
            basicLog(`  Main agent: 1 prompt`);
            basicLog(`  Subagents: ${subagentSpecs.length} prompt(s)`);
        });
};