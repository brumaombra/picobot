import { join } from 'path';
import { pathToFileURL } from 'url';

export default {
    name: 'run_project_check',
    description: 'Executes a simple verification against the sample project and reports expected versus actual values.',
    parameters: {
        type: 'object',
        properties: {}
    },
    execute: async (_args, context) => {
        const modulePath = join(context.runtime.rootDir, 'project', 'src', 'pricing.js');
        const pricingModule = await import(pathToFileURL(modulePath).href);
        const actual = pricingModule.calculateTotal(12, 3);

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
