import { describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { UsersService } from '../../src/users/users.service';

describe('RolesGuard', () => {
  it('rejects USER for an ADMIN route', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]) };
    const context = {
      getHandler: vi.fn(), getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.USER } }) }),
    };
    expect(new RolesGuard(reflector as never).canActivate(context as never)).toBe(false);
  });

  it('accepts SUPER_ADMIN for an ADMIN route', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]) };
    const context = {
      getHandler: vi.fn(), getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.SUPER_ADMIN } }) }),
    };
    expect(new RolesGuard(reflector as never).canActivate(context as never)).toBe(true);
  });

  it('does not allow ADMIN to manage another administrator', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'admin-2', role: Role.ADMIN }),
        update: vi.fn(),
      },
    };
    const service = new UsersService(prisma as never, {} as never);
    await expect(service.updateForAdmin(
      { userId: 'admin-1', sessionId: 'session-1', email: 'admin@example.com', role: Role.ADMIN },
      'admin-2',
      { isActive: false },
    )).rejects.toThrow('SUPER_ADMIN is required');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
