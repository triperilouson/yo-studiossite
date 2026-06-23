import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShippingMethod } from '@prisma/client';
import { AdminAuditService } from '../common/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePickupLocationDto, CreateShippingCountryDto, ShippingSelectionDto,
  UpdatePickupLocationDto, UpdateShippingCountryDto,
} from './dto/shipping.dto';

type DatabaseClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AdminAuditService) {}

  publicOptions() {
    return Promise.all([
      this.prisma.shippingCountry.findMany({
        where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.pickupLocation.findMany({
        where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]).then(([countries, pickupLocations]) => ({ countries, pickupLocations }));
  }

  async quote(userId: string, selection: ShippingSelectionDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { variant: true } } },
    });
    if (!cart?.items.length) throw new ConflictException('Cart is empty');
    const currencies = new Set(cart.items.map(({ variant }) => variant.currency));
    if (currencies.size !== 1) throw new ConflictException('Cart contains different currencies');
    const subtotalMinor = cart.items.reduce((sum, item) => sum + item.variant.priceMinor * item.quantity, 0);
    return this.resolve(this.prisma, userId, selection, subtotalMinor, cart.items[0]!.variant.currency);
  }

  async resolve(
    db: DatabaseClient, userId: string, selection: ShippingSelectionDto,
    subtotalMinor: number, currency: string,
  ) {
    if (selection.method === ShippingMethod.PICKUP) {
      if (!selection.pickupLocationId) throw new ConflictException('Pickup location is required');
      const pickup = await db.pickupLocation.findFirst({
        where: { id: selection.pickupLocationId, isActive: true },
      });
      if (!pickup) throw new NotFoundException('Pickup location is unavailable');
      return {
        method: ShippingMethod.PICKUP, shippingMinor: 0, currency,
        address: null,
        pickupLocation: {
          id: pickup.id, slug: pickup.slug, name: pickup.name, country: pickup.country,
          city: pickup.city, address: pickup.address, details: pickup.details,
        },
      };
    }

    let address;
    if (selection.addressId) {
      address = await db.address.findFirst({ where: { id: selection.addressId, userId } });
      if (!address) throw new NotFoundException('Checkout address not found');
    } else if (selection.address) {
      address = {
        label: selection.address.label?.trim() || 'Checkout',
        fullName: selection.address.fullName.trim(),
        phone: selection.address.phone.trim(),
        country: selection.address.country.toUpperCase(),
        state: selection.address.state?.trim() || null,
        city: selection.address.city.trim(),
        postalCode: selection.address.postalCode.trim(),
        line1: selection.address.line1.trim(),
        line2: selection.address.line2?.trim() || null,
        isDefault: false,
      };
    } else {
      throw new ConflictException('Delivery address is required');
    }
    const country = await db.shippingCountry.findFirst({
      where: { code: address.country.toUpperCase(), isActive: true },
    });
    if (!country) throw new ConflictException('Delivery is unavailable for this country');
    if (country.currency !== currency) throw new ConflictException('Shipping currency does not match cart currency');
    if (country.minOrderMinor !== null && subtotalMinor < country.minOrderMinor) {
      throw new ConflictException('Order does not meet the minimum for this destination');
    }
    if (country.maxOrderMinor !== null && subtotalMinor > country.maxOrderMinor) {
      throw new ConflictException('Order exceeds the maximum for this destination');
    }
    const shippingMinor = country.freeThresholdMinor !== null && subtotalMinor >= country.freeThresholdMinor
      ? 0 : country.priceMinor;
    return {
      method: ShippingMethod.DELIVERY, shippingMinor, currency,
      country: { code: country.code, name: country.name }, address,
      estimatedMinDays: country.estimatedMinDays, estimatedMaxDays: country.estimatedMaxDays,
      pickupLocation: null,
    };
  }

  adminOptions() {
    return Promise.all([
      this.prisma.shippingCountry.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.pickupLocation.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]).then(([countries, pickupLocations]) => ({ countries, pickupLocations }));
  }

  async createCountry(actorId: string, input: CreateShippingCountryDto) {
    this.assertDays(input.estimatedMinDays, input.estimatedMaxDays);
    this.assertOrderRange(input.minOrderMinor, input.maxOrderMinor);
    try {
      const country = await this.prisma.shippingCountry.create({ data: { ...input, code: input.code.toUpperCase() } });
      await this.audit.record(actorId, 'SHIPPING_COUNTRY_CREATED', 'ShippingCountry', country.id, { code: country.code });
      return country;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Shipping country already exists');
      }
      throw error;
    }
  }

  async updateCountry(actorId: string, id: string, input: UpdateShippingCountryDto) {
    const current = await this.prisma.shippingCountry.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Shipping country not found');
    this.assertDays(input.estimatedMinDays ?? current.estimatedMinDays, input.estimatedMaxDays ?? current.estimatedMaxDays);
    this.assertOrderRange(input.minOrderMinor ?? current.minOrderMinor ?? undefined, input.maxOrderMinor ?? current.maxOrderMinor ?? undefined);
    const country = await this.prisma.shippingCountry.update({ where: { id }, data: input });
    await this.audit.record(actorId, 'SHIPPING_COUNTRY_UPDATED', 'ShippingCountry', id, { active: country.isActive });
    return country;
  }

  async createPickup(actorId: string, input: CreatePickupLocationDto) {
    try {
      const pickup = await this.prisma.pickupLocation.create({ data: input });
      await this.audit.record(actorId, 'PICKUP_LOCATION_CREATED', 'PickupLocation', pickup.id);
      return pickup;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Pickup location slug already exists');
      }
      throw error;
    }
  }

  async updatePickup(actorId: string, id: string, input: UpdatePickupLocationDto) {
    if (!(await this.prisma.pickupLocation.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Pickup location not found');
    }
    const pickup = await this.prisma.pickupLocation.update({ where: { id }, data: input });
    await this.audit.record(actorId, 'PICKUP_LOCATION_UPDATED', 'PickupLocation', id, { active: pickup.isActive });
    return pickup;
  }

  private assertDays(minimum: number, maximum: number) {
    if (minimum > maximum) throw new ConflictException('Minimum delivery days cannot exceed maximum');
  }

  private assertOrderRange(minimum?: number, maximum?: number) {
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      throw new ConflictException('Minimum order cannot exceed maximum order');
    }
  }
}
