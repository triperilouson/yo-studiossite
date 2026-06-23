import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationSuite = testDatabaseUrl ? describe : describe.skip;

integrationSuite('PostgreSQL transaction integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    if (!parsed.pathname.toLowerCase().includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a dedicated test database');
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('rolls back every write when a transaction fails', async () => {
    const email = `rollback-${randomUUID()}@example.test`;
    await expect(prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email,
          passwordHash: 'integration-test-only',
          firstName: 'Rollback',
          lastName: 'Test',
        },
      });
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
  });

  it('rejects an order with negative monetary totals at the database boundary', async () => {
    const email = `negative-order-${randomUUID()}@example.test`;
    const user = await prisma.user.create({
      data: { email, passwordHash: 'integration-test-only', firstName: 'Negative', lastName: 'Order' },
    });
    try {
      await expect(prisma.order.create({
        data: {
          userId: user.id,
          emailSnapshot: email,
          phoneSnapshot: '+972500000000',
          nameSnapshot: 'Negative Order',
          currency: 'ILS',
          subtotalMinor: -1,
          shippingMinor: 0,
          totalMinor: -1,
          idempotencyKey: randomUUID(),
        },
      })).rejects.toThrow();
      await expect(prisma.order.count({ where: { userId: user.id } })).resolves.toBe(0);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
