import { toolCategories } from '../tools.js';
import { logger } from '../../utils/logger.js';

// The list of categories that can be routed to (all except 'general')
const routableCategories = ['web', 'filesystem', 'cron', 'gmail', 'calendar', 'drive'];

// Route to category tool (Returns tools for a specific category)
export const routeToCategoryTool = {
    // Tool definition
    name: 'route_to_category',
    description: 'Load specialized tools for a specific domain category.',
    parameters: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: routableCategories,
                description: `The category of tools to load.`
            }
        },
        required: ['category']
    },

    // Main execution function
    execute: async args => {
        const { category } = args;

        // Get the category
        const categoryConfig = toolCategories[category];

        // Log routing
        logger.info(`Routing to category: ${categoryConfig.name} (${category})`);

        try {
            // Get tool definitions for the category
            const categoryTools = categoryConfig.tools;
            const toolNames = categoryTools.map(tool => tool.name).join(', ');

            // Return success with tool definitions to add to available tools
            return {
                success: true,
                output: `Loaded ${categoryTools.length} ${categoryConfig.name} tools: ${toolNames}`,
                addTools: { categories: [category] } // Signal to add these tools to available tools for the current conversation
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Route to category error: ${errorMessage}`);
            return {
                success: false,
                error: `Failed to load category tools: ${errorMessage}`
            };
        }
    }
};