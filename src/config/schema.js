import { z } from 'zod';
import { OPENROUTER_MODELS, DEFAULT_WORKSPACE_PATH } from '../config.js';

// Telegram configuration
export const TelegramConfigSchema = z.object({
    token: z.string().min(1, 'Telegram bot token is required'),
    allowedUsers: z.array(z.string().trim().min(1, 'Allowed user entries cannot be empty')).min(1, 'At least one Telegram allowed user is required')
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

// Google AI configuration (optional — required for video analysis)
export const GoogleAiConfigSchema = z.object({
    apiKey: z.string().min(1, 'Google AI API key is required')
});

// Root configuration
export const configSchema = z.object({
    workspace: z.string().default(DEFAULT_WORKSPACE_PATH),
    telegram: TelegramConfigSchema,
    openRouter: OpenRouterConfigSchema,
    agent: AgentConfigSchema.default({}),
    brave: BraveConfigSchema.optional(),
    googleAi: GoogleAiConfigSchema.optional(),
    nvr: NvrConfigSchema.optional()
});