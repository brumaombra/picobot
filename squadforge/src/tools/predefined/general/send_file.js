import { existsSync } from 'fs';
import { isAbsolute, normalize, relative, resolve } from 'path';

// Send file tool
export const sendFileTool = {
    name: 'send_file',
    description: 'Send a file attachment to the current channel using the runtime outbound message contract.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'File path, relative to the runtime root or absolute inside the runtime workspace.'
            },
            caption: {
                type: 'string',
                description: 'Optional text caption sent alongside the file.'
            }
        },
        required: ['filePath']
    },

    // Main execution function
    execute: async ({ filePath, caption }, { runtime, sessionId, emitOutboundMessage }) => {
        const workspaceRoot = runtime.workspaceDir || runtime.rootDir || process.cwd();
        const normalizedWorkspaceRoot = normalize(resolve(workspaceRoot));
        const fullPath = normalize(isAbsolute(filePath) ? filePath : resolve(normalizedWorkspaceRoot, filePath));
        const relativePath = relative(normalizedWorkspaceRoot, fullPath);
        const isInsideWorkspace = relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));

        // If it's out of workspace bounds, reject
        if (!isInsideWorkspace) {
            return {
                success: false,
                error: 'Access denied: filePath must stay inside the runtime workspace.'
            };
        }

        // If the file doesn't exist, reject
        if (!existsSync(fullPath)) {
            return {
                success: false,
                error: `File not found: ${filePath}`
            };
        }

        // Emit the outbound message with the file attachment
        await emitOutboundMessage({
            sessionId,
            role: 'assistant',
            content: caption || '',
            file: {
                path: fullPath,
                caption: caption || undefined
            }
        });

        // Return a success message
        return {
            success: true,
            output: `File sent: ${filePath}`
        };
    }
};