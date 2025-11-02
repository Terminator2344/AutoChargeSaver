import { Router } from 'express';
import { verifyWhopSignature } from '../integrations/whop.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { recoveryMessage } from '../domain/messageTemplates.js';
import { send } from '../notifications/sender.js';
import { makeRecoveryLink } from '../tracking/clickRedirect.js';
import { isRecoveredByClick } from '../domain/attribution.js';
export const whopRouter = Router();
whopRouter.post('/webhooks/whop', async (req, res) => {
    const payload = req.body;
    const webhookStartTime = Date.now();
    // Логирование webhook
    let webhookLog = await prisma.webhookLog.create({
        data: {
            eventId: payload.id,
            eventType: payload.type,
            status: 'processing',
            payload: payload,
            receivedAt: new Date(),
        },
    }).catch(() => null);
    if (!verifyWhopSignature(req)) {
        if (webhookLog) {
            await prisma.webhookLog.update({
                where: { id: webhookLog.id },
                data: { status: 'invalid', error: 'Invalid signature' },
            }).catch(() => { });
        }
        return res.status(401).json({ error: 'invalid_signature' });
    }
    const occurredAt = new Date(payload.occurredAt);
    try {
        // Idempotency: skip if event exists
        const existing = await prisma.event.findUnique({ where: { whopEventId: payload.id } });
        if (existing) {
            if (webhookLog) {
                await prisma.webhookLog.update({
                    where: { id: webhookLog.id },
                    data: { status: 'idempotent' },
                }).catch(() => { });
            }
            return res.status(200).json({ ok: true, idempotent: true });
        }
        // Upsert user
        const upsertedUser = await prisma.user.upsert({
            where: { whopUserId: payload.user.whopUserId },
            create: {
                whopUserId: payload.user.whopUserId,
                email: payload.user.email,
                tgUserId: payload.meta?.telegram,
                discordUserId: payload.meta?.discord,
                twitterHandle: payload.meta?.twitter,
                instagramId: payload.meta?.instagram,
            },
            update: {
                email: payload.user.email ?? undefined,
                tgUserId: payload.meta?.telegram ?? undefined,
                discordUserId: payload.meta?.discord ?? undefined,
                twitterHandle: payload.meta?.twitter ?? undefined,
                instagramId: payload.meta?.instagram ?? undefined,
            },
        });
        const event = await prisma.event.create({
            data: {
                whopEventId: payload.id,
                userId: upsertedUser.id,
                type: payload.type,
                amountCents: payload.amountCents,
                currency: payload.currency,
                occurredAt,
                meta: payload.meta,
            },
        });
        logger.info({ type: payload.type, userId: upsertedUser.id }, 'Webhook processed');
        if (payload.type === 'payment_failed') {
            const link = makeRecoveryLink(upsertedUser.id, {});
            const msg = recoveryMessage({ userName: upsertedUser.email || undefined, link });
            const results = await Promise.all([
                send({ channel: 'email', to: { email: upsertedUser.email || undefined }, message: msg }),
                send({ channel: 'telegram', to: { tgUserId: upsertedUser.tgUserId || undefined }, message: { text: msg.text } }),
                send({ channel: 'discord', to: {}, message: { text: msg.text } }),
                send({ channel: 'twitter', to: { twitterHandle: upsertedUser.twitterHandle || undefined }, message: { text: msg.text } }),
                send({ channel: 'instagram', to: { instagramId: upsertedUser.instagramId || undefined }, message: { text: msg.text } }),
            ]);
            if (webhookLog) {
                await prisma.webhookLog.update({
                    where: { id: webhookLog.id },
                    data: { status: 'success' },
                }).catch(() => { });
            }
            logger.info({ type: payload.type, userId: upsertedUser.id, duration: Date.now() - webhookStartTime }, 'Webhook processed: payment_failed');
            return res.json({ ok: true, eventId: event.id, results });
        }
        if (payload.type === 'payment_succeeded') {
            const { byClick, channel } = await isRecoveredByClick(upsertedUser.id, occurredAt);
            await prisma.event.update({
                where: { id: event.id },
                data: { recovered: true, reason: byClick ? 'click' : 'window', channel: byClick ? channel : null },
            });
            if (webhookLog) {
                await prisma.webhookLog.update({
                    where: { id: webhookLog.id },
                    data: { status: 'success' },
                }).catch(() => { });
            }
            logger.info({ type: payload.type, userId: upsertedUser.id, recovered: true, duration: Date.now() - webhookStartTime }, 'Webhook processed: payment_succeeded');
            return res.json({ ok: true, recovered: true, reason: byClick ? 'click' : 'window', channel: channel || null });
        }
        if (webhookLog) {
            await prisma.webhookLog.update({
                where: { id: webhookLog.id },
                data: { status: 'success' },
            }).catch(() => { });
        }
        logger.info({ type: payload.type, userId: upsertedUser.id, duration: Date.now() - webhookStartTime }, 'Webhook processed');
        return res.json({ ok: true });
    }
    catch (error) {
        logger.error({ error: error?.message, payload: payload.id }, 'Webhook processing error');
        if (webhookLog) {
            await prisma.webhookLog.update({
                where: { id: webhookLog.id },
                data: { status: 'error', error: error?.message || String(error) },
            }).catch(() => { });
        }
        return res.status(500).json({ error: 'processing_failed', message: error?.message });
    }
});
