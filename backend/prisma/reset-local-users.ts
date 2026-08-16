import { PrismaClient, Role } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

loadLocalEnv();

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to reset users while NODE_ENV=production');
}

if (process.env.ALLOW_LOCAL_USER_RESET !== 'true') {
  throw new Error('Set ALLOW_LOCAL_USER_RESET=true to confirm local user reset');
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: { not: Role.SUPER_ADMIN } },
    select: { id: true, email: true, role: true },
  });

  const result = { deleted: 0, anonymized: 0, skippedSuperAdmins: 0 };

  for (const user of users) {
    const outcome = await prisma.$transaction(async (tx) => {
      const orderCount = await tx.order.count({ where: { userId: user.id } });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'local_reset_for_email_verification' },
      });
      await tx.authToken.deleteMany({ where: { userId: user.id } });
      await tx.address.deleteMany({ where: { userId: user.id } });

      const cart = await tx.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.delete({ where: { id: cart.id } });
      }

      if (orderCount > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: `deleted-${user.id}@deleted.yo.local`,
            firstName: 'Deleted',
            lastName: 'User',
            phone: null,
            isActive: false,
            role: Role.USER,
            failedLoginAttempts: 0,
            lockedUntil: null,
            adminMfaSecret: null,
            adminMfaEnabled: false,
            emailVerifiedAt: null,
          },
        });
        return 'anonymized' as const;
      }

      await tx.user.delete({ where: { id: user.id } });
      return 'deleted' as const;
    });

    if (outcome === 'deleted') result.deleted += 1;
    if (outcome === 'anonymized') result.anonymized += 1;
    console.log(`${outcome}: ${user.role} ${user.email.replace(/(^.).*(@.*$)/, '$1***$2')}`);
  }

  result.skippedSuperAdmins = await prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
