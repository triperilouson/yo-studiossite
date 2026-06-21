import { describe, expect, it, vi } from 'vitest';
import { ProductStatus } from '@prisma/client';
import { OrdersService } from '../../src/orders/orders.service';

describe('OrdersService checkout', () => {
  it('rolls back before creating an order when atomic inventory reservation fails', async () => {
    const tx = {
      order: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue({
        email: 'buyer@example.com', firstName: 'A', lastName: 'B', phone: null, isActive: true,
      }) },
      address: { findFirst: vi.fn().mockResolvedValue({ id: 'address', phone: '+972500000000' }) },
      cart: { findUnique: vi.fn().mockResolvedValue({
        id: 'cart',
        items: [{
          quantity: 1,
          variant: {
            id: '7077589d-329d-4ab5-814d-e09a6e62c396', sku: 'YO-L', currency: 'ILS',
            priceMinor: 1000, productId: 'f56c1c11-4700-4347-a7f7-90f7b23f98e5', isActive: true,
            product: { status: ProductStatus.ACTIVE, title: 'TEE' }, size: 'L',
          },
        }],
      }) },
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = new OrdersService(prisma as never, {} as never);

    await expect(service.checkout('user', 'address', 'safe-idempotency-key'))
      .rejects.toThrow('YO-L is out of stock');
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
