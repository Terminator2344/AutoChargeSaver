import { prisma } from '../config/prisma.js';
export async function recordClick(userId, channel, messageId) {
    return prisma.click.create({ data: { userId, channel, messageId } });
}
