import { join } from 'path';
import { pathToFileURL } from 'url';

// Sample project verification tool
export default {
    // Tool definition
    name: 'run_project_check',
    description: 'Executes a simple verification against the sample project and reports expected versus actual values.',
    parameters: {
        type: 'object',
        properties: {}
    },

    // Main execution function
    execute: async (_args, context) => {
        // Resolve the sample module under test
        const modulePath = join(context.runtime.rootDir, 'project', 'src', 'pricing.js');

        // Load the module dynamically from disk
        const pricingModule = await import(pathToFileURL(modulePath).href);

        // Run the sample verification case
        const actual = pricingModule.calculateTotal(12, 3);

        // Return expected versus actual output
        return {
            success: true,
            output: {
                case: 'calculateTotal(12, 3)',
                expected: 36,
                actual,
                passed: actual === 36
            }
        };
    }
};