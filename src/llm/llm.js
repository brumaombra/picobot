import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { OPENROUTER_MAX_TOKENS, OPENROUTER_TEMPERATURE, OPENROUTER_TOOL_CHOICE, OPENROUTER_REQUEST_TIMEOUT_MS } from '../config.js';

// LLM provider class
export class Llm {
    // Create a new LLM provider instance
    constructor({ apiKey } = {}) {
        // Validate API key
        if (!apiKey) {
            throw new Error('API key is required');
        }

        // Create the OpenRouter client
        this.client = new OpenAI({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            timeout: OPENROUTER_REQUEST_TIMEOUT_MS
        });

        // Log initialization
        logger.info('LLM provider initialized');
    }

    // Send a chat completion request
    async chat(messages, tools = [], model) {
        // Validate model
        if (!model) {
            throw new Error('Model is required');
        }

        try {
            // Send the chat completion request
            const response = await this.client.chat.completions.create({
                model,
                messages,
                max_tokens: OPENROUTER_MAX_TOKENS,
                temperature: OPENROUTER_TEMPERATURE,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? OPENROUTER_TOOL_CHOICE : undefined
            });

            // Get the choice
            const choice = response.choices[0];
            if (!choice) {
                throw new Error('No response from OpenRouter API');
            }

            // Create the result object
            const result = {
                content: choice.message?.content,
                tool_calls: choice.message?.tool_calls || [],
                finish_reason: choice.finish_reason || 'stop',
                usage: {
                    prompt_tokens: response.usage?.prompt_tokens || 0,
                    completion_tokens: response.usage?.completion_tokens || 0,
                    total_tokens: response.usage?.total_tokens || 0
                }
            };

            // Log and return the result
            logger.debug(`LLM response: ${result.finish_reason}, tools: ${result.tool_calls?.length || 0}`);
            return result;
        } catch (error) {
            logger.error(`LLM chat error: ${error}`);
            throw error;
        }
    }
}