import { logger } from 'squadforge';
import { handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';
import { WEB_FETCH_TIMEOUT_MS, WEB_MAX_CONTENT_LENGTH, WEB_USER_AGENT } from '../../../src/config.js';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Generic HTTP API request tool
export default {
    // Tool definition
    name: 'api_request',
    description: 'Perform structured HTTP API requests with explicit method, headers, query parameters, and optional body.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'Base URL to call.'
            },
            method: {
                type: 'string',
                description: 'HTTP method to use. Defaults to GET.',
                enum: ALLOWED_METHODS
            },
            query: {
                type: 'object',
                description: 'Optional query parameters to append to the URL. Values will be stringified.'
            },
            headers: {
                type: 'object',
                description: 'Optional request headers as key/value pairs.'
            },
            body: {
                description: 'Optional request body. Objects/arrays are JSON-encoded automatically unless Content-Type is set differently. Strings are sent as-is.'
            }
        },
        required: ['url']
    },

    // Main execution function
    execute: async args => {
        const method = String(args.method || 'GET').toUpperCase();

        // Validate HTTP method
        if (!ALLOWED_METHODS.includes(method)) {
            return handleToolError({ message: `Unsupported HTTP method: ${method}` });
        }

        // Validate URL
        let url;
        try {
            url = new URL(args.url);
        } catch {
            return handleToolError({ message: 'Invalid URL format' });
        }

        // Append query parameters
        if (args.query && typeof args.query === 'object' && !Array.isArray(args.query)) {
            for (const [key, value] of Object.entries(args.query)) {
                if (value === undefined || value === null) continue;
                url.searchParams.append(String(key), typeof value === 'string' ? value : JSON.stringify(value));
            }
        }

        // Prepare request headers
        const headers = normalizeHeaders(args.headers);

        // Ensure User-Agent and Accept headers are set
        if (!headers['User-Agent'] && !headers['user-agent']) {
            headers['User-Agent'] = WEB_USER_AGENT;
        }

        // If no Accept header provided, default to accepting JSON and plain text
        if (!headers.Accept && !headers.accept) {
            headers.Accept = 'application/json, text/plain, */*';
        }

        // Build the fetch options
        const requestOptions = {
            method,
            headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS)
        };

        // Attach request body for supported methods
        if (args.body !== undefined) {
            // Validate that body is not included for methods that don't support it
            if (!METHODS_WITH_BODY.includes(method)) {
                return handleToolError({ message: `${method} requests should not include a body` });
            }

            // If body is a string, send as-is. Otherwise, JSON-encode it.
            if (typeof args.body === 'string') {
                requestOptions.body = args.body;
            } else {
                requestOptions.body = JSON.stringify(args.body);
                if (!headers['Content-Type'] && !headers['content-type']) {
                    headers['Content-Type'] = 'application/json';
                }
            }
        }

        // Log request attempt
        logger.debug(`API request: ${method} ${url.toString()}`);

        try {
            // Execute the HTTP request
            const response = await fetch(url.toString(), requestOptions);
            const contentType = response.headers.get('content-type') || '';
            let responseBody;

            // Parse the response body based on content type
            if (contentType.includes('application/json')) {
                responseBody = await response.json();
            } else {
                responseBody = await response.text();
            }

            // Format the response payload
            const output = {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                url: response.url,
                method,
                contentType,
                headers: Object.fromEntries(response.headers.entries()),
                body: formatResponseBody(responseBody)
            };

            // Check for HTTP errors
            if (!response.ok) {
                return handleToolError({ message: `HTTP error: ${response.status} ${response.statusText}\n${JSON.stringify(output.body)}` });
            }

            // Return the API response
            return handleToolResponse(output);
        } catch (error) {
            return handleToolError({ error, message: `Failed to perform ${method} request` });
        }
    }
};

// Truncate large response content to fit tool output limits
const truncateContent = value => {
    const text = typeof value === 'string' ? value : JSON.stringify(value);

    // If content is within limits, return as-is
    if (text.length <= WEB_MAX_CONTENT_LENGTH) {
        return text;
    }

    // Otherwise, truncate and indicate truncation
    return text.slice(0, WEB_MAX_CONTENT_LENGTH) + '\n... (content truncated)';
};

// Keep JSON structured when small, otherwise fall back to truncated text
const formatResponseBody = value => {
    // If it's already a string, just truncate if needed
    if (typeof value === 'string') {
        return truncateContent(value);
    }

    // For objects/arrays, try to keep them structured if they fit within limits
    const serialized = JSON.stringify(value);
    if (serialized.length <= WEB_MAX_CONTENT_LENGTH) {
        return value;
    }

    // If too large, return truncated string representation
    return truncateContent(serialized);
};

// Normalize request headers into string key/value pairs
const normalizeHeaders = headers => {
    // If no headers provided, return empty object
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
        return {};
    }

    // Filter out invalid headers
    return Object.fromEntries(
        Object.entries(headers)
            .filter(([key]) => key)
            .map(([key, value]) => [String(key), String(value)])
    );
};