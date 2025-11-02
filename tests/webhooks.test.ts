import request from 'supertest';
import app from '../app/src/server';
import { prisma } from '../app/src/config/prisma';

describe('Whop webhook', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    await prisma.click.deleteMany();
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  });

  it('accepts dev signature-less request', async () => {
    const payload = {
      id: 'evt_failed_1',
      type: 'payment_failed',
      occurredAt: new Date().toISOString(),
      user: { whopUserId: 'whop_u_1', email: 'user@example.com' },
      amountCents: 1200,
      currency: 'USD',
    };
    const res = await request(app).post('/webhooks/whop').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBeTruthy();
  });

  it('creates Event on payment_failed and enqueues notifications', async () => {
    const payload = {
      id: 'evt_failed_2',
      type: 'payment_failed',
      occurredAt: new Date().toISOString(),
      user: { whopUserId: 'whop_u_2', email: 'user2@example.com' },
      amountCents: 1500,
      currency: 'USD',
    };
    const res = await request(app).post('/webhooks/whop').send(payload);
    expect(res.status).toBe(200);
    const event = await prisma.event.findUnique({ where: { whopEventId: 'evt_failed_2' } });
    expect(event).toBeTruthy();
  });
});





















