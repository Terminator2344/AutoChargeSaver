import request from 'supertest';
import app from '../app/src/server';
import { prisma } from '../app/src/config/prisma';

describe('Click tracking', () => {
  it('records click and 200s', async () => {
    const user = await prisma.user.create({ data: { whopUserId: 'whop_u_click', email: 'c@example.com' } });
    const res = await request(app).get(`/r/${user.id}?c=email&m=123`);
    expect(res.status).toBe(200);
    const clicks = await prisma.click.findMany({ where: { userId: user.id } });
    expect(clicks.length).toBeGreaterThan(0);
  });
});



















