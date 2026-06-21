import { describe, expect, it, vi } from 'vitest';
import { CartService } from '../../src/cart/cart.service';

describe('CartService', () => {
  it('rejects a quantity larger than current available inventory', async () => {
    const tx = {
      cart: { upsert: vi.fn().mockResolvedValue({ id: 'cart' }) },
      productVariant: { findFirst: vi.fn().mockResolvedValue({ id: 'variant', stock: 2, reservedStock: 0 }) },
      cartItem: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = new CartService(prisma as never);

    await expect(service.add('user', {
      productId: '7077589d-329d-4ab5-814d-e09a6e62c396', size: 'L', quantity: 3,
    })).rejects.toThrow('Requested quantity is not in stock');
    expect(tx.cartItem.upsert).not.toHaveBeenCalled();
  });
});

