import { dirname, join } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { Agent, OpenRouterLlm } from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleRoot = __dirname;
const envPath = join(exampleRoot, '.env');

if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
}

const args = process.argv.slice(2);
const initialPrompt = args.join(' ');

if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required for this example. It is intended to run against a real model over a real project-style folder layout.');
}

const llm = new OpenRouterLlm({
    apiKey: process.env.OPENROUTER_API_KEY
});

const model = process.env.SQUADFORGE_MODEL || 'x-ai/grok-4.1-fast';

const createCliChannel = ({ initialMessage = '', onClose = null } = {}) => {
    const sessionId = 'cli:local';
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    let isClosed = false;

    const promptUser = () => {
        if (!isClosed) {
            rl.prompt();
        }
    };

    return {
        onMessage(receiveMessage) {
            rl.setPrompt('You> ');
            rl.on('line', line => {
                const content = line.trim();

                if (!content) {
                    promptUser();
                    return;
                }

                if (content === '/exit' || content === '/quit') {
                    rl.close();
                    return;
                }

                receiveMessage({
                    sessionId,
                    role: 'user',
                    content
                });
            });

            rl.on('close', () => {
                isClosed = true;
                if (typeof onClose === 'function') {
                    onClose();
                }
            });

            queueMicrotask(() => {
                console.log('Interactive Squadforge CLI started. Type /exit to quit.');
                if (initialMessage) {
                    console.log(`You> ${initialMessage}`);
                    receiveMessage({
                        sessionId,
                        role: 'user',
                        content: initialMessage
                    });
                    return;
                }

                promptUser();
            });

            return () => {
                if (!isClosed) {
                    rl.close();
                }
            };
        },
        async sendMessage(message) {
            console.log(`Pico> ${message.content || '(no response)'}`);
            promptUser();
            return message;
        }
    };
};

try {
    console.log(`Using model: ${model}`);
    console.log(`Project root: ${exampleRoot}`);
    console.log('Booting root agent...');

    const agent = await Agent.assemble({
        rootDir: exampleRoot,
        llm,
        model,
        maxRuntimeMs: 5 * 60 * 1000,
        wrapUpThresholdMs: 60 * 1000
    });

    agent.on('agentSpawn', event => {
        console.log(`[spawn] ${event.parentAgentType} -> ${event.agentType}`);
    });

    agent.on('agentIteration', event => {
        console.log(`[thinking] ${event.agentType} iteration ${event.iteration}`);
    });

    agent.on('toolStart', event => {
        console.log(`[tool] ${event.agentType} -> ${event.toolName}`);
    });

    agent.on('toolError', event => {
        console.log(`[tool-error] ${event.agentType} -> ${event.toolName}: ${event.error}`);
    });

    agent.on('agentComplete', event => {
        console.log(`[done] ${event.agentType}`);
    });

    let resolveClosed;
    const closedPromise = new Promise(resolve => {
        resolveClosed = resolve;
    });

    const channel = createCliChannel({
        initialMessage: initialPrompt,
        onClose: () => {
            resolveClosed();
        }
    });
    agent.onMessage(channel.onMessage);
    agent.sendMessage(channel.sendMessage);

    const shutdown = async () => {
        await agent.stop();
    };

    process.once('SIGINT', async () => {
        console.log('\nShutting down...');
        await shutdown();
        process.exit(0);
    });

    console.log('Starting interactive chat...');
    console.log('');

    await agent.start();
    await closedPromise;
    await shutdown();
} catch (error) {
    console.error('Example run failed.');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
}