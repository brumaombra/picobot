import { dirname, join } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { forge, OpenRouterLlm } from '../../src/index.js';

// Resolve the example root and local env file path
const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleRoot = __dirname;
const envPath = join(exampleRoot, '.env');

// Load local example env vars when supported by the current Node version
if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
}

// Read any initial prompt passed on the command line
const args = process.argv.slice(2);
const initialPrompt = args.join(' ');

// Ensure the example has an OpenRouter API key before booting
if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required for this example. It is intended to run against a real model over a real project-style folder layout.');
}

// Create the OpenRouter LLM client for the example runtime
const llm = new OpenRouterLlm({
    apiKey: process.env.OPENROUTER_API_KEY
});

// Resolve the model from env or fall back to the default example model
const model = process.env.SQUADFORGE_MODEL || 'x-ai/grok-4.1-fast';

// Create a tiny CLI channel for interactive local testing
const createCliChannel = ({ initialMessage = '', onClose = null } = {}) => {
    const sessionId = 'cli:local';
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    let isClosed = false;

    // Re-display the prompt after agent replies and ignored input
    const promptUser = () => {
        if (!isClosed) {
            rl.prompt();
        }
    };

    return {
        // Wire terminal input into the runtime channel
        onMessage(receiveMessage) {
            rl.setPrompt('You> ');
            rl.on('line', line => {
                const content = line.trim();

                // Ignore empty input and keep the prompt open
                if (!content) {
                    promptUser();
                    return;
                }

                // Support explicit exit commands
                if (content === '/exit' || content === '/quit') {
                    rl.close();
                    return;
                }

                // Forward user messages into the runtime
                receiveMessage({
                    sessionId,
                    role: 'user',
                    content
                });
            });

            // Notify the caller when the CLI channel closes
            rl.on('close', () => {
                isClosed = true;
                if (typeof onClose === 'function') {
                    onClose();
                }
            });

            // Start the CLI on the next microtask so listeners are ready
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

            // Return a cleanup function for the runtime channel
            return () => {
                if (!isClosed) {
                    rl.close();
                }
            };
        },

        // Print agent messages back to the CLI
        async sendMessage(message) {
            console.log(`Pico> ${message.content || '(no response)'}`);
            promptUser();
            return message;
        }
    };
};

try {
    // Print basic startup context for the example run
    console.log(`Using model: ${model}`);
    console.log(`Project root: ${exampleRoot}`);
    console.log('Booting root agent...');

    // Create the example Squadforge runtime
    const agent = await forge({
        rootDir: exampleRoot,
        llm,
        model,
        maxRuntimeMs: 5 * 60 * 1000,
        wrapUpThresholdMs: 60 * 1000
    });

    // Print high-level runtime events for easier debugging
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

    // Track when the interactive CLI closes
    let resolveClosed;
    const closedPromise = new Promise(resolve => {
        resolveClosed = resolve;
    });

    // Connect the CLI channel to the runtime
    const channel = createCliChannel({
        initialMessage: initialPrompt,
        onClose: () => {
            resolveClosed();
        }
    });
    agent.onMessage(channel.onMessage);
    agent.sendMessage(channel.sendMessage);

    // Stop the runtime cleanly when the process exits
    const shutdown = async () => {
        await agent.stop();
    };

    // Handle Ctrl+C shutdown in the terminal
    process.once('SIGINT', async () => {
        console.log('\nShutting down...');
        await shutdown();
        process.exit(0);
    });

    // Start the runtime and wait for the CLI session to finish
    console.log('Starting interactive chat...');
    console.log('');

    await agent.start();
    await closedPromise;
    await shutdown();
} catch (error) {
    // Print failures in a friendly way for local debugging
    console.error('Example run failed.');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
}