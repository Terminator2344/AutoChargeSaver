// app/src/config/prisma.ts
import type { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

const createMockCollection = () => ({
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (data: any) => ({ id: 'mock-id', ...data.data }),
  update: async () => ({}),
  delete: async () => ({}),
  count: async () => 0,
  aggregate: async () => ({ _sum: { amountCents: 0 } }),
  groupBy: async () => [],
  upsert: async (args: any) => ({ id: 'mock-id', ...args.create }),
});

async function initPrisma() {
  if (prismaInstance) return prismaInstance;

  try {
    const { PrismaClient } = await import('@prisma/client');
    prismaInstance = new PrismaClient({
      log: ['error', 'warn'],
    });
    await prismaInstance.$connect();
    return prismaInstance;
  } catch (err) {
    console.warn('⚠️ Prisma client not available — using mock client (offline mode)');
    const mockCollection = createMockCollection();
    prismaInstance = {
      $connect: async () => {},
      $disconnect: async () => {},
      event: mockCollection,
      user: mockCollection,
      click: mockCollection,
    } as any;
    return prismaInstance;
  }
}

// Initialize immediately
const prisma = await initPrisma();

export { prisma };

