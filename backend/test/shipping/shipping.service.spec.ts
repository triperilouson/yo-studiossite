import { describe, expect, it, vi } from 'vitest';
import { ShippingMethod } from '@prisma/client';
import { ShippingService } from '../../src/shipping/shipping.service';

describe('ShippingService', () => {
  it('calculates free delivery from backend country rules', async () => {
    const db = {
      address: { findFirst: vi.fn().mockResolvedValue({ id: 'address', country: 'IL' }) },
      shippingCountry: { findFirst: vi.fn().mockResolvedValue({
        code: 'IL', name: 'Israel', currency: 'ILS', priceMinor: 3000,
        freeThresholdMinor: 50000, minOrderMinor: null, maxOrderMinor: null,
        estimatedMinDays: 2, estimatedMaxDays: 5,
      }) },
    };
    const service = new ShippingService({} as never, {} as never);
    const quote = await service.resolve(
      db as never, 'user', { method: ShippingMethod.DELIVERY, addressId: 'address' }, 50000, 'ILS',
    );
    expect(quote.shippingMinor).toBe(0);
    expect(quote.method).toBe(ShippingMethod.DELIVERY);
  });

  it('never trusts an address for pickup and returns the configured location', async () => {
    const db = {
      pickupLocation: { findFirst: vi.fn().mockResolvedValue({
        id: 'pickup', slug: 'studio', name: 'YO STUDIO', country: 'IL', city: 'Tel Aviv',
        address: 'Studio address', details: null,
      }) },
    };
    const service = new ShippingService({} as never, {} as never);
    const quote = await service.resolve(
      db as never, 'user', { method: ShippingMethod.PICKUP, pickupLocationId: 'pickup' }, 1000, 'ILS',
    );
    expect(quote.shippingMinor).toBe(0);
    expect(quote.pickupLocation?.name).toBe('YO STUDIO');
  });
});
