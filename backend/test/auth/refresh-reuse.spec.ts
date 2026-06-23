import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/auth/auth.service';

vi.mock('argon2', () => ({ argon2id: 2, hash: vi.fn(), verify: vi.fn() }));

describe('refresh token reuse detection', () => {
  beforeEach(() => vi.mocked(argon2.verify).mockResolvedValue(true));

  it('revokes every active user session when a revoked token is reused', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      authSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'e17dd27d-9be8-4ec4-a560-560778a02040',
          userId: '7077589d-329d-4ab5-814d-e09a6e62c396',
          refreshTokenHash: 'hash',
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 10_000),
          user: { isActive: true },
        }),
        updateMany,
      },
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.refresh('e17dd27d-9be8-4ec4-a560-560778a02040.secret', { ip: '127.0.0.1' }))
      .rejects.toThrow('Refresh token reuse detected');
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: '7077589d-329d-4ab5-814d-e09a6e62c396', revokedAt: null },
    }));
  });
});
