import { logger } from '../../utils/logger.js';

// Authorization middleware
export const authMiddleware = async (context, next, allowedUsers) => {
    // If no allowed users configured, allow all
    if (allowedUsers?.length === 0) {
        await next();
        return;
    }

    // Get user ID and username
    const userId = context.from?.id?.toString();
    const username = context.from?.username;

    // If no user ID, deny access
    if (!userId) {
        logger.warn(`Unauthorized access from user ${context.from?.id}`);
        return;
    }

    // Check against allowed users
    const allowed = allowedUsers?.some(allowedUser => {
        // Check by user ID
        if (allowedUser === userId) {
            return true;
        }

        // Check by username (with or without @)
        if (username) {
            const normalizedAllowed = allowedUser.replace(/^@/, '');
            return normalizedAllowed === username;
        }

        // Not allowed
        return false;
    });

    // If user is allowed, continue to next handler
    if (allowed) {
        await next();
    } else {
        logger.warn(`Unauthorized access from user ${context.from?.id}`);
    }
};