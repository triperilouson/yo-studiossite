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
});

