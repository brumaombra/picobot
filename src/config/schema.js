import { z } from 'zod';
import { OPENROUTER_MODELS, DEFAULT_WORKSPACE_PATH, DEFAULT_LOG_LEVEL, LOG_LEVELS } from '../config.js';

// Telegram configuration
export const TelegramConfigSchema = z.object({
    token: z.string().min(1, 'Telegram bot token is required'),
    allowedUsers: z.array(z.string()).default([])
});

// OpenRouter provider configuration
export const OpenRouterConfigSchema = z.object({
    apiKey: z.string().min(1, 'OpenRouter API key is required')
});

// Agent configuration
export const AgentConfigSchema = z.object({
    model: z.enum(OPENROUTER_MODELS).default(OPENROUTER_MODELS[0]),
    loadAgentProfile: z.boolean().default(true),
    loadUserProfile: z.boolean().default(true)
});

// Root configuration
export const ConfigSchema = z.object({
    telegram: TelegramConfigSchema,
    openRouter: OpenRouterConfigSchema,
    agent: AgentConfigSchema.default({}),
    workspace: z.string().default(DEFAULT_WORKSPACE_PATH),
    logLevel: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL)
});