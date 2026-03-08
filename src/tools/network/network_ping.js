import ping from 'ping';
import { handleToolError, handleToolResponse } from '../../utils/common/utils.js';

// Network ping diagnostic tool powered by the ping npm package.
export const networkPingTool = {
    // Tool definition
    name: 'network_ping',
    description: 'Ping a host to test network reachability and latency.',
    parameters: {
        type: 'object',
        properties: {
            host: {
                type: 'string',
                description: 'Hostname or IP address to ping.'
            }
        },
        required: ['host']
    },

    // Main execution function
    execute: async args => {
        const { host } = args;
        const pingCount = 4;

        try {
            // Run ping probe with a fixed cross-platform timeout
            const result = await ping.promise.probe(host, {
                timeout: 10,
                min_reply: pingCount
            });

            // Parse numeric stats when available
            const packetLossPercent = Number.isFinite(Number(result.packetLoss)) ? Number(result.packetLoss) : null;
            const averageLatencyMs = Number.isFinite(Number(result.avg)) ? Number(result.avg) : null;

            // Return normalized ping diagnostics
            return handleToolResponse({
                host,
                platform: process.platform,
                count: pingCount,
                reachable: Boolean(result.alive),
                timedOut: !result.alive && packetLossPercent === 100,
                packetLossPercent,
                averageLatencyMs
            });
        } catch (error) {
            return handleToolError({ error, message: 'Network ping failed' });
        }
    }
};