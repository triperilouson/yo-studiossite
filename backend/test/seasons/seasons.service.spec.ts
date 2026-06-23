import { describe, expect, it, vi } from 'vitest';
import { SeasonStatus } from '@prisma/client';
import { SeasonsService } from '../../src/seasons/seasons.service';

describe('SeasonsService', () => {
  it('exposes only published seasons in the storefront collection navigation', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new SeasonsService({ season: { findMany } } as never, {} as never);
    await service.listPublic(false);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: SeasonStatus.PUBLISHED },
    }));
  });
});
