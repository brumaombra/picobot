import { executeCommand, handleToolError, handleToolResponse } from '../../../src/utils/common/utils.js';

// Network DNS lookup tool
export const networkDnsLookupTool = {
    // Tool definition
    name: 'network_dns_lookup',
    description: 'Resolve DNS records for a hostname.',
    parameters: {
        type: 'object',
        properties: {
            host: {
                type: 'string',
                description: 'Hostname to resolve.'
            },
            recordType: {
                type: 'string',
                enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'ANY'],
                description: 'DNS record type to resolve (default: ANY).'
            }
        },
        required: ['host']
    },

    // Main execution function
    execute: async args => {
        const { host, recordType = 'ANY' } = args;

        try {
            // Normalize and validate inputs
            const normalizedHost = String(host || '').trim();
            const normalizedType = String(recordType || 'ANY').toUpperCase();
            const commandArgs = normalizedType === 'ANY' ? [normalizedHost] : ['-type=' + normalizedType, normalizedHost];

            // Run nslookup and return raw output for LLM interpretation
            const result = await executeCommand({
                command: 'nslookup',
                args: commandArgs,
                timeoutMs: 15000
            });

            // Check for errors in execution and return appropriate responses
            if (result.error) {
                return handleToolError({ message: `DNS lookup failed: ${result.error}` });
            }

            // Return minimal output payload
            return handleToolResponse({
                platform: process.platform,
                rawOutput: result.rawOutput || '(no output)'
            });
        } catch (error) {
            return handleToolError({ error, message: 'DNS lookup failed' });
        }
    }
};