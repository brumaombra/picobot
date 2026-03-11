import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { OpenRouterLlm, Squad } from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleRoot = __dirname;
const envPath = join(exampleRoot, '.env');

if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
}

const args = process.argv.slice(2);
const prompt = args
    .join(' ')
    || 'Investigate why the sample checkout project computes the wrong total and explain the root cause.';

if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required for this example. It is intended to run against a real model over a real project-style folder layout.');
}

const llm = new OpenRouterLlm({
    apiKey: process.env.OPENROUTER_API_KEY
});

const model = process.env.SQUADFORGE_MODEL || 'x-ai/grok-4.1-fast';

try {
    console.log(`Using model: ${model}`);
    console.log(`Project root: ${exampleRoot}`);
    console.log('Booting squad...');

    const squad = await Squad.assemble({
        rootDir: exampleRoot,
        llm,
        model,
        maxIterations: 8
    });

    squad.on('agentSpawn', event => {
        console.log(`[spawn] ${event.parentAgentType} -> ${event.agentType}`);
    });

    squad.on('agentIteration', event => {
        console.log(`[thinking] ${event.agentType} iteration ${event.iteration}`);
    });

    squad.on('toolStart', event => {
        console.log(`[tool] ${event.agentType} -> ${event.toolName}`);
    });

    squad.on('toolError', event => {
        console.log(`[tool-error] ${event.agentType} -> ${event.toolName}: ${event.error}`);
    });

    squad.on('agentComplete', event => {
        console.log(`[done] ${event.agentType}`);
    });

    console.log('Sending prompt...');
    console.log('');

    const result = await squad.send(prompt);

    console.log('');
    console.log('Prompt:');
    console.log(prompt);
    console.log('');
    console.log('Response:');
    console.log(result.response || '(no response)');
    console.log('');
    console.log('Agents:');
    console.log(squad.listAgentSpecs().map(spec => spec.id).join(', '));
    console.log('');
    console.log('Prompt Files:');
    console.log('prompts/SUBAGENTS.md, prompts/TOOLS.md, prompts/SKILLS.md, prompts/SUBAGENT.md');
    console.log('');
    console.log('Skills:');
    console.log(squad.listSkills().map(skill => skill.id).join(', ') || '(none)');
    console.log('');
    console.log('Project Files:');
    console.log('project/package.json, project/src/pricing.js, project/src/checkout.js, project/tests/pricing.test.js');
    console.log('');
    console.log('Spawned subagents:');
    console.log(squad.listRunningSubagents().map(agent => `${agent.id}:${agent.definition.id}`).join(', ') || '(none)');
} catch (error) {
    console.error('Example run failed.');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
}