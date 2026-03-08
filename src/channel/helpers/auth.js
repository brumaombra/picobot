import { logger } from '../../utils/common/logger.js';

// Authorization middleware
export const authMiddleware = async (context, next, allowedUsers) => {
    // If allowlist is missing or empty, fail closed
    if (!allowedUsers?.length) {
        logger.error('Telegram allowlist is empty. Access denied until at least one allowed user is configured.');
        await context.reply('⛔ Bot is not configured correctly. An admin must set at least one allowed Telegram user.');
        return;
    }

    // Get user ID and username
    const userId = context.from?.id?.toString();
    const username = context.from?.username;

    // If no user ID, deny access
    if (!userId) {
        logger.warn(`Unauthorized access from unknown user`);
        return;
    }

    // Check against allowed users (normalize @ prefix once per entry)
    const allowed = allowedUsers.some(user => {
        const normalized = user.replace(/^@/, '');
        return normalized === userId || normalized === username;
    });

    // If user is allowed, continue to next handler
    if (allowed) {
        await next();
    } else {
        logger.warn(`Unauthorized access from user ${userId}`);
        await context.reply('⛔ You are not authorized to use this bot.');
    }
};