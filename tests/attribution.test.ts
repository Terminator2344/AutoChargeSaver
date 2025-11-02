import { prisma } from '../app/src/config/prisma';
import { isRecoveredByClick } from '../app/src/domain/attribution';

describe('Attribution logic', () => {
  it('by click within window', async () => {
    const user = await prisma.user.create({ data: { whopUserId: 'whop_attr_1' } });
    const now = new Date();
    const dayBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await prisma.click.create({ data: { userId: user.id, channel: 'email', clickedAt: dayBefore } });
    const res = await isRecoveredByClick(user.id, now);
    expect(res.byClick).toBe(true);
    expect(res.channel).toBe('email');
  });
});




















