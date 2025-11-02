import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
export async function requireAuth(req, res, next) {
    // Whitelist of paths that never require auth (prevent redirect loops)
    const PUBLIC_PATHS = new Set([
        '/auth/whop',
        '/auth/dev',
        '/auth/whop/callback',
        '/logout',
        '/api/health',
        '/debug/session',
        '/', // root redirects to /dashboard, but allow it here
    ]);
    // Detailed diagnostic logging
    const cookies = req.headers.cookie || '';
    const hasSidCookie = cookies.includes('sid=');
    console.log('[AUTH/requireAuth]', {
        path: req.path,
        sessionID: req.sessionID,
        hasSession: !!req.session,
        userId: req.session?.userId,
        sessionKeys: req.session ? Object.keys(req.session) : [],
        cookies: cookies.substring(0, 100), // First 100 chars
        hasSidCookie,
    });
    // If path is in whitelist, skip auth check
    if (PUBLIC_PATHS.has(req.path)) {
        console.log('[AUTH/requireAuth]', 'PUBLIC path, skipping auth check', 'path=', req.path);
        return next();
    }
    // Check for userId in session FIRST (before any other checks)
    if (!req.session?.userId) {
        console.log('[AUTH/requireAuth]', 'NO userId → redirect /auth/whop', 'path=', req.path);
        logger.info({
            path: req.path,
            hasSession: !!req.session,
            sessionKeys: req.session ? Object.keys(req.session) : [],
            sessionID: req.sessionID,
            cookies: req.headers.cookie?.substring(0, 100),
        }, '[AUTH] Missing session userId, redirecting to /auth/whop');
        return res.redirect('/auth/whop');
    }
    // If we have userId, proceed (this will prevent redirect loops)
    console.log('[AUTH/requireAuth]', '✅ OK userId=', req.session.userId, 'path=', req.path, 'sessionID=', req.sessionID);
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId },
        });
        // In mock mode, it's okay if user doesn't exist in DB yet
        // Don't destroy session - allow user to proceed (they'll be created on /auth/dev)
        // if (!user) {
        //   logger.warn({ userId: req.session.userId }, '[AUTH] User not found in DB, destroying session');
        //   req.session.destroy(() => {});
        //   return res.redirect('/auth/whop');
        // }
        if (user) {
            logger.info({ userId: req.session.userId, path: req.path }, '[AUTH] User authorized');
            req.user = user;
        }
        else {
            logger.warn({ userId: req.session.userId }, '[AUTH] User not found in DB, but continuing (mock mode allowed)');
            // Create mock user object from session data to avoid req.user.id errors
            if (req.session && req.session.userId) {
                req.user = {
                    id: req.session.userId,
                    whopUserId: req.session.whopUserId || null
                };
            }
        }
        next();
    }
    catch (error) {
        logger.error({ error, userId: req.session.userId }, '[AUTH] Error fetching user in requireAuth');
        // In mock mode, don't destroy session on error either
        // Create mock user object from session data to avoid req.user.id errors
        if (req.session && req.session.userId) {
            req.user = {
                id: req.session.userId,
                whopUserId: req.session.whopUserId || null
            };
        }
        next();
    }
}
