import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/cart-item.dto';

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true, slug: true, title: true, status: true,
              images: {
                select: { id: true, url: true, alt: true, position: true },
                orderBy: { position: 'asc' as const },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { userId }, create: { userId }, update: {}, include: cartInclude,
    });
    return this.toResponse(cart);
  }

  async add(userId: string, input: AddCartItemDto) {
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
      const variant = await tx.productVariant.findFirst({
        where: {
          productId: input.productId,
          size: input.size.trim().toUpperCase(),
          isActive: true,
          product: { status: ProductStatus.ACTIVE },
        },
      });
      if (!variant) throw new NotFoundException('Product size not found');
      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      });
      const quantity = (existing?.quantity ?? 0) + input.quantity;
      if (quantity > 10) throw new ConflictException('Maximum quantity per item is 10');
      if (variant.stock - variant.reservedStock < quantity) {
        throw new ConflictException('Requested quantity is not in stock');
      }
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
        create: { cartId: cart.id, variantId: variant.id, quantity },
        update: { quantity },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.get(userId);
  }

  async update(userId: string, itemId: string, quantity: number) {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
        include: { variant: { include: { product: true } } },
      });

      if (!item) throw new NotFoundException('Cart item not found');

      if (!item.variant.isActive || item.variant.product.status !== ProductStatus.ACTIVE) {
        throw new ConflictException('Product size is unavailable');
      }

      if (quantity > 10) {
        throw new ConflictException('Maximum quantity per item is 10');
      }

      if (item.variant.stock - item.variant.reservedStock < quantity) {
        throw new ConflictException('Requested quantity is not in stock');
      }

      await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return this.get(userId);
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const deleted = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
    if (!deleted.count) throw new NotFoundException('Cart item not found');
  }

  async clear(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  }

  private toResponse<T extends { items: Array<{
    id: string; quantity: number;
    variant: { id: string; size: string; sku: string; priceMinor: number; currency: string; stock: number; reservedStock: number; product: unknown };
  }> }>(cart: T) {
    const items = cart.items.map((item) => ({
      id: item.id,
      product: item.variant.product,
      variantId: item.variant.id,
      sku: item.variant.sku,
      size: item.variant.size,
      quantity: item.quantity,
      unitPriceMinor: item.variant.priceMinor,
      currency: item.variant.currency,
      available: Math.max(0, item.variant.stock - item.variant.reservedStock),
      lineTotalMinor: item.variant.priceMinor * item.quantity,
    }));
    return {
      items,
      currency: items[0]?.currency ?? 'ILS',
      subtotalMinor: items.reduce((sum, item) => sum + item.lineTotalMinor, 0),
    };
  }
}
