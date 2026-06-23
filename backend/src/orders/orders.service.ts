import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuditService } from '../common/admin-audit.service';
import { ShippingService } from '../shipping/shipping.service';
import type { CheckoutDto } from './dto/checkout.dto';
import { MailService } from '../mail/mail.service';

const orderResponseSelect = {
  id: true, status: true, currency: true, subtotalMinor: true, shippingMinor: true,
  totalMinor: true, emailSnapshot: true, nameSnapshot: true, phoneSnapshot: true,
  addressSnapshot: true, shippingMethod: true, shippingCountryCode: true,
  pickupLocationSnapshot: true, createdAt: true, updatedAt: true,
  items: { select: { productIdSnapshot: true, skuSnapshot: true, titleSnapshot: true, sizeSnapshot: true, unitPriceMinor: true, quantity: true } },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly shipping: ShippingService,
    private readonly mail: MailService,
  ) {}

  async checkout(userId: string, selection: CheckoutDto, idempotencyKey: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } }, select: orderResponseSelect,
        });
        if (existing) return { order: existing, created: false };

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true, phone: true, isActive: true },
        });
        if (!user?.isActive) throw new NotFoundException('Checkout user not found');

        const cart = await tx.cart.findUnique({
          where: { userId },
          include: { items: { include: { variant: { include: { product: true } } } } },
        });
        if (!cart?.items.length) throw new ConflictException('Cart is empty');

        const currencies = new Set(cart.items.map((item) => item.variant.currency));
        if (currencies.size !== 1) throw new ConflictException('Cart contains different currencies');

        for (const item of cart.items) {
          if (!item.variant.isActive || item.variant.product.status !== ProductStatus.ACTIVE) {
            throw new ConflictException(`${item.variant.sku} is unavailable`);
          }
          const reserved = await tx.$executeRaw`
            UPDATE "ProductVariant"
            SET "reservedStock" = "reservedStock" + ${item.quantity}, "updatedAt" = NOW()
            WHERE "id" = ${item.variant.id}::uuid
              AND "isActive" = TRUE
              AND "stock" - "reservedStock" >= ${item.quantity}
          `;
          if (reserved !== 1) throw new ConflictException(`${item.variant.sku} is out of stock`);
        }

        const subtotalMinor = cart.items.reduce(
          (sum, item) => sum + item.variant.priceMinor * item.quantity, 0,
        );
        const currency = cart.items[0]!.variant.currency;
        const shipping = await this.shipping.resolve(tx, userId, selection, subtotalMinor, currency);
        const address = shipping.address;
        const order = await tx.order.create({
          data: {
            userId,
            status: OrderStatus.PENDING_PAYMENT,
            emailSnapshot: selection.email.trim().toLowerCase(),
            phoneSnapshot: selection.phone.trim(),
            nameSnapshot: `${selection.firstName.trim()} ${selection.lastName.trim()}`,
            addressSnapshot: address ? {
              label: address.label, fullName: address.fullName, phone: address.phone,
              country: address.country, state: address.state, city: address.city,
              postalCode: address.postalCode, line1: address.line1, line2: address.line2,
            } : undefined,
            shippingMethod: shipping.method,
            shippingCountryCode: shipping.method === 'DELIVERY' ? shipping.country.code : shipping.pickupLocation.country,
            pickupLocationSnapshot: shipping.pickupLocation ?? undefined,
            currency, subtotalMinor, shippingMinor: shipping.shippingMinor,
            totalMinor: subtotalMinor + shipping.shippingMinor, idempotencyKey,
            items: {
              create: cart.items.map((item) => ({
                variantId: item.variant.id,
                productIdSnapshot: item.variant.productId,
                skuSnapshot: item.variant.sku,
                titleSnapshot: item.variant.product.title,
                sizeSnapshot: item.variant.size,
                unitPriceMinor: item.variant.priceMinor,
                quantity: item.quantity,
              })),
            },
          },
          select: orderResponseSelect,
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return { order, created: true };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
      if (result.created) await this.mail.sendOrderCreated(result.order);
      return result.order;
    } catch (error: unknown) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ServiceUnavailableException('Inventory changed; retry checkout with the same idempotency key');
      }
      throw error;
    }
  }

  async getOwned(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId }, select: orderResponseSelect,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  listForAdmin() {
    return this.prisma.order.findMany({ select: orderResponseSelect, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async updateStatusForAdmin(actorId: string, orderId: string, status: OrderStatus) {
    if (status === OrderStatus.PAID || status === OrderStatus.FAILED || status === OrderStatus.REFUNDED) {
      throw new ConflictException('Payment result can only be changed by a verified payment webhook');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      const allowed =
        (order.status === OrderStatus.PENDING_PAYMENT && status === OrderStatus.CANCELLED) ||
        (order.status === OrderStatus.PAID && status === OrderStatus.SHIPPED) ||
        (order.status === OrderStatus.SHIPPED &&
          (status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED));
      if (!allowed) throw new ConflictException(`Invalid order transition: ${order.status} -> ${status}`);
      if (order.status === OrderStatus.PENDING_PAYMENT && status === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          const released = await tx.$executeRaw`
            UPDATE "ProductVariant"
            SET "reservedStock" = "reservedStock" - ${item.quantity}, "updatedAt" = NOW()
            WHERE "id" = ${item.variantId}::uuid
              AND "reservedStock" >= ${item.quantity}
          `;
          if (released !== 1) throw new ConflictException('Reserved inventory is inconsistent');
        }
      }
      return tx.order.update({ where: { id: orderId }, data: { status }, select: orderResponseSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record(actorId, 'ORDER_STATUS_UPDATED', 'Order', orderId, { status });
    await this.mail.sendOrderStatus(updated);
    return updated;
  }
}
