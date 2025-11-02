import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { makeRecoveryLink } from '../tracking/clickRedirect.js';
import { recoveryMessage } from '../domain/messageTemplates.js';
import { send } from '../notifications/sender.js';
export const recoveryRouter = Router();
const bodySchema = z.object({ userId: z.string(), eventId: z.string().optional() });
recoveryRouter.post('/api/notify-failed', requireAuth, async (req, res) => {
    const currentUserId = req.user.id;
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'invalid_body' });
    const { userId } = parsed.data;
    // Проверка, что пользователь запрашивает уведомление только для себя
    if (userId !== currentUserId) {
        return res.status(403).json({ error: 'forbidden' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return res.status(404).json({ error: 'user_not_found' });
    const link = makeRecoveryLink(user.id, {});
    const msg = recoveryMessage({ userName: user.email || undefined, link });
    const results = await Promise.all([
        send({ channel: 'email', to: { email: user.email || undefined }, message: msg }),
        send({ channel: 'telegram', to: { tgUserId: user.tgUserId || undefined }, message: { text: msg.text } }),
        send({ channel: 'discord', to: {}, message: { text: msg.text } }),
        send({ channel: 'twitter', to: { twitterHandle: user.twitterHandle || undefined }, message: { text: msg.text } }),
        send({ channel: 'instagram', to: { instagramId: user.instagramId || undefined }, message: { text: msg.text } }),
    ]);
    res.json({ ok: true, results });
});
