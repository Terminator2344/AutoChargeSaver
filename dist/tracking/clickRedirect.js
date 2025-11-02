import { recordClick } from './recorder.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
export function makeRecoveryLink(userId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.channel)
        params.set('c', opts.channel);
    if (opts.messageId)
        params.set('m', opts.messageId);
    const qs = params.toString();
    return `${env.APP_HOST}/r/${userId}${qs ? `?${qs}` : ''}`;
}
export async function clickRedirectHandler(req, res) {
    const { userId } = req.params;
    const channel = typeof req.query.c === 'string' ? req.query.c : undefined;
    const messageId = typeof req.query.m === 'string' ? req.query.m : undefined;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            await recordClick(userId, channel || 'unknown', messageId);
        }
    }
    catch {
        // swallow
    }
    const redirectUrl = '#';
    if (redirectUrl && redirectUrl !== '#') {
        res.redirect(302, redirectUrl);
        return;
    }
    res.status(200).send(`<html><body><h1>Update your payment</h1><p>Please follow instructions sent to you to update your card.</p></body></html>`);
}
