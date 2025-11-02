import { prisma } from '../config/prisma.js';

export async function recordClick(userId: string, channel: string, messageId?: string) {
  return prisma.click.create({ data: { userId, channel, messageId } });
}



















