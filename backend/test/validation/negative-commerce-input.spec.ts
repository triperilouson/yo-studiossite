import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AddCartItemDto, UpdateCartItemDto } from '../../src/cart/dto/cart-item.dto';
import { CreateVariantDto, UpdateInventoryDto } from '../../src/products/dto/admin-product.dto';

describe('negative commerce input validation', () => {
  const invalidInstances = [
    plainToInstance(UpdateCartItemDto, { quantity: -1 }),
    plainToInstance(AddCartItemDto, { productId: 'edb9df25-50bc-4d3a-a420-9b9873529fe3', size: 'M', quantity: 0 }),
    plainToInstance(CreateVariantDto, { sku: 'NEGATIVE', size: 'M', priceMinor: -1, currency: 'ILS', stock: 1 }),
    plainToInstance(UpdateInventoryDto, { stock: -1 }),
  ];

  it.each(invalidInstances)('rejects invalid negative or zero values for $constructor.name', async (instance) => {
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
  });
});
