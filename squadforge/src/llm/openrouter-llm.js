import OpenAI from 'openai';
import { DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE, DEFAULT_TOOL_CHOICE } from '../config.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Create the OpenRouterLlm class
export class OpenRouterLlm {
    // Constructor
    constructor({ apiKey, baseURL = OPENROUTER_BASE_URL, timeout = DEFAULT_REQUEST_TIMEOUT_MS, maxTokens = DEFAULT_MAX_TOKENS, temperature = DEFAULT_TEMPERATURE, toolChoice = DEFAULT_TOOL_CHOICE } = {}) {
        // Validate the apiKey parameter
        if (!apiKey) {
            throw new Error('OpenRouterLlm requires an apiKey.');
        }

        // Initialize the OpenAI client
        this.client = new OpenAI({
            apiKey,
            baseURL,
            timeout
        });

        // Set default parameters
        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.toolChoice = toolChoice;
    }

    // Chat method to send messages and receive responses from the OpenRouter API
    async chat(messages, tools = [], model) {
        // Validate the model parameter
        if (!model) {
            throw new Error('OpenRouterLlm requires a model.');
        }

        // Send the chat completion request to the OpenRouter API
        const response = await this.client.chat.completions.create({
            model,
            messages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? this.toolChoice : undefined
        });

        // Validate the response and extract the relevant data
        const choice = response.choices?.[0];
        if (!choice) {
            const errorMessage = response.error?.message || 'No response from OpenRouter.';
            throw new Error(errorMessage);
        }

        // Return the response
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