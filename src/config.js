import { homedir } from 'os';
import { join } from 'path';

/**************** Application *****************/
export const APP_NAME = 'picobot';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Ultra-lightweight AI agent with Telegram and OpenRouter integration';

/**************** Paths *****************/
export const CONFIG_DIR = join(homedir(), '.picobot');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
export const WORKSPACE_DIR = join(CONFIG_DIR, 'workspace');
export const PROMPTS_DIR = join(CONFIG_DIR, 'prompts');
export const SESSIONS_DIR = join(CONFIG_DIR, 'sessions');
export const JOBS_DIR = join(CONFIG_DIR, 'jobs');
export const LOGS_DIR = join(CONFIG_DIR, 'logs');
export const DEFAULT_WORKSPACE_PATH = '~/.picobot/workspace';

/**************** Agent *****************/
export const MAX_AGENT_ITERATIONS = 15;
export const QUEUE_POLL_TIMEOUT_MS = 1000;
export const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**************** Session *****************/
export const MAX_MESSAGES_PER_SESSION = 50;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**************** LLM / OpenRouter Provider *****************/
export const OPENROUTER_MAX_TOKENS = 4096;
export const OPENROUTER_TEMPERATURE = 0.7;
export const OPENROUTER_TOOL_CHOICE = 'auto';
export const OPENROUTER_REQUEST_TIMEOUT_MS = 60 * 1000; // 60 seconds
export const OPENROUTER_MODELS = [
    'x-ai/grok-4.1-fast',
    'x-ai/grok-code-fast-1',
    'anthropic/claude-haiku-4.5',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-opus-4.5',
    'openai/gpt-5.2',
    'openai/gpt-5',
    'openai/gpt-5-nano',
    'openai/gpt-5-mini',
    'google/gemini-3-flash-preview',
    'moonshotai/kimi-k2.5',
    'deepseek/deepseek-v3.2'
];

/**************** Subagent Models *****************/
export const SUBAGENT_MODEL_TIERS = {
    standard: {
        model: 'x-ai/grok-4.1-fast',
        description: 'Fast, cost-effective responses for simple tasks and quick answers'
    },
    medium: {
        model: 'anthropic/claude-sonnet-4.5',
        description: 'Balanced performance for most complex tasks requiring good reasoning'
    },
    performance: {
        model: 'anthropic/claude-opus-4.5',
        description: 'Highest quality responses for critical tasks needing maximum accuracy'
    }
};

/**************** Telegram *****************/
export const TELEGRAM_TYPING_INTERVAL_MS = 4000;
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4000;
export const TELEGRAM_WELCOME_MESSAGE = '👋 Hello! I\'m Picobot, your AI assistant powered by AI!\n\nJust send me a message and I\'ll help you out!';

/**************** Shell tool *****************/
export const SHELL_MAX_OUTPUT_LENGTH = 10000;
export const SHELL_DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
export const SHELL_MAX_BUFFER = 1024 * 1024; // 1 MB
export const SHELL_BLOCKED_COMMANDS = ['rm -rf /', 'format', 'mkfs', ':(){:|:&};:'];

/**************** Web tool *****************/
export const WEB_MAX_CONTENT_LENGTH = 15000;
export const WEB_FETCH_TIMEOUT_MS = 30000; // 30 seconds
export const WEB_USER_AGENT = 'Mozilla/5.0 (compatible; Picobot/1.0)';
export const WEB_ACCEPT_HEADER = 'text/html,application/json,text/plain';

/**************** Logging *****************/
export const DEFAULT_LOG_LEVEL = 'info';
export const LOG_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const LOG_FILENAME = join(LOGS_DIR, 'picobot.log');
export const LOG_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const ERROR_LOG_FILENAME = join(LOGS_DIR, 'picobot-error.log');
export const ERROR_LOG_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];