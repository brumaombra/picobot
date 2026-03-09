import OpenAI from 'openai';
import { OPENROUTER_BASE_URL, OPENROUTER_REQUEST_TIMEOUT_MS, OPENROUTER_MAX_TOKENS, OPENROUTER_TEMPERATURE, OPENROUTER_TOOL_CHOICE } from '../config.js';

export class OpenRouterLlm {
    constructor({ apiKey, baseURL = OPENROUTER_BASE_URL, timeout = OPENROUTER_REQUEST_TIMEOUT_MS, maxTokens = OPENROUTER_MAX_TOKENS, temperature = OPENROUTER_TEMPERATURE, toolChoice = OPENROUTER_TOOL_CHOICE } = {}) {
        if (!apiKey) {
            throw new Error('OpenRouterLlm requires an apiKey.');
        }

        this.client = new OpenAI({
            apiKey,
            baseURL,
            timeout
        });

        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.toolChoice = toolChoice;
    }

    async chat(messages, tools = [], model) {
        if (!model) {
            throw new Error('OpenRouterLlm requires a model.');
        }

        const response = await this.client.chat.completions.create({
            model,
            messages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? this.toolChoice : undefined
        });

        const choice = response.choices?.[0];
        if (!choice) {
            const errorMessage = response.error?.message || 'No response from OpenRouter.';
            throw new Error(errorMessage);
        }

        return {
            content: choice.message?.content,
            tool_calls: choice.message?.tool_calls || [],
            finish_reason: choice.finish_reason || 'stop',
            usage: {
                prompt_tokens: response.usage?.prompt_tokens || 0,
                completion_tokens: response.usage?.completion_tokens || 0,
                total_tokens: response.usage?.total_tokens || 0
            }
        };
    }
}