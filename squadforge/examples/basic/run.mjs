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

const model = process.env.SQUADFORGE_MODEL || 'openai/gpt-5-mini';

const logEvent = event => {
    if (event.type === 'agent:spawn') {
        console.log(`[spawn] ${event.parentAgentType} -> ${event.agentType}`);
        return;
    }

    if (event.type === 'agent:iteration') {
        console.log(`[thinking] ${event.agentType} iteration ${event.iteration}`);
        return;
    }

    if (event.type === 'tool:start') {
        console.log(`[tool] ${event.agentType} -> ${event.toolName}`);
        return;
    }

    if (event.type === 'tool:error') {
        console.log(`[tool-error] ${event.agentType} -> ${event.toolName}: ${event.error}`);
        return;
    }

    if (event.type === 'agent:complete') {
        console.log(`[done] ${event.agentType}`);
    }
};

try {
    console.log(`Using model: ${model}`);
    console.log(`Project root: ${exampleRoot}`);
    console.log('Booting squad...');

    const squad = await Squad.assemble({
        rootDir: exampleRoot,
        llm,
        model,
        onEvent: logEvent,
        maxIterations: 8
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