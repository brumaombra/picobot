import { toolCategories } from '../tools.js';
import { logger } from '../../utils/logger.js';

// The list of categories that can be routed to (all except 'general')
const routableCategories = ['gmail', 'calendar', 'drive'];

// Route to category tool (Returns tools for a specific category)
export const routeToCategoryTool = {
    // Tool definition
    name: 'route_to_category',
    description: 'Load specialized tools for a specific domain category. Returns tool definitions that become available for use. Use this to access specific tools when needed for the current task.',
    parameters: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: routableCategories,
                description: `The category of tools to load. Available categories: ${routableCategories.join(', ')}`
            }
        },
        required: ['category']
    },

    // Main execution function
    execute: async args => {
        const { category } = args;

        // Validate category
        const categoryConfig = toolCategories[category];
        if (!categoryConfig) {
            return {
                success: false,
                output: '',
                error: `Unknown category: ${category}. Available: ${routableCategories.join(', ')}`
            };
        }

        // Log routing
        logger.info(`Routing to category: ${category} (${categoryConfig.name})`);

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
                output: '',
                error: `Failed to load category tools: ${errorMessage}`
            };
        }
    }
};