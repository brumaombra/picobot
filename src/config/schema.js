import { z } from 'zod';
import { OPENROUTER_MODELS, DEFAULT_WORKSPACE_PATH } from '../config.js';

// Telegram configuration
export const TelegramConfigSchema = z.object({
    token: z.string().min(1, 'Telegram bot token is required'),
    allowedUsers: z.array(z.string()).default([])
});

// OpenRouter provider configuration
export const OpenRouterConfigSchema = z.object({
    apiKey: z.string().min(1, 'OpenRouter API key is required')
});

// Brave Search API configuration (optional)
export const BraveConfigSchema = z.object({
    apiKey: z.string().min(1, 'Brave Search API key is required')
});

// Agent configuration
export const AgentConfigSchema = z.object({
    model: z.enum(OPENROUTER_MODELS).default(OPENROUTER_MODELS[0])
});

// Reolink NVR configuration (optional)
export const NvrConfigSchema = z.object({
    host: z.string().min(1, 'NVR host is required'),
    username: z.string().min(1, 'NVR username is required'),
    password: z.string().min(1, 'NVR password is required')
});

// Root configuration
export const ConfigSchema = z.object({
    telegram: TelegramConfigSchema,
    openRouter: OpenRouterConfigSchema,
    brave: BraveConfigSchema.optional(),
    agent: AgentConfigSchema.default({}),
    nvr: NvrConfigSchema.optional(),
    workspace: z.string().default(DEFAULT_WORKSPACE_PATH)
});