import request from 'supertest';
import app from '../app/src/server';
import { prisma } from '../app/src/config/prisma';

describe('Analytics API', () => {
  it('returns aggregates', async () => {
    await prisma.event.create({ data: { userId: (await prisma.user.create({ data: { whopUserId: 'whop_a1' } })).id, type: 'payment_failed', occurredAt: new Date() } });
    const res = await request(app).get('/api/analytics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('failed');
  });
});




















