import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { AddressDto } from './dto/address.dto';
import { AdminDeleteUserDto, AdminUpdateUserDto } from './dto/admin-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminAuditService } from '../common/admin-audit.service';
import * as argon2 from 'argon2';

const safeUserSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true,
  role: true, isActive: true, emailVerifiedAt: true, createdAt: true, updatedAt: true,
  adminMfaEnabled: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AdminAuditService) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  updateProfile(userId: string, input: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.firstName ? { firstName: input.firstName.trim() } : {}),
        ...(input.lastName ? { lastName: input.lastName.trim() } : {}),
        ...(input.phone ? { phone: input.phone.trim() } : {}),
      },
      select: safeUserSelect,
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async createAddress(userId: string, input: AddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...input, country: input.country.toUpperCase(), userId } });
    });
  }

  async updateAddress(userId: string, addressId: string, input: AddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!address) throw new NotFoundException('Address not found');
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({
        where: { id: address.id }, data: { ...input, country: input.country.toUpperCase() },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const deleted = await this.prisma.address.deleteMany({ where: { id: addressId, userId } });
    if (!deleted.count) throw new NotFoundException('Address not found');
  }

  orderHistory(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      select: {
        id: true, status: true, currency: true, subtotalMinor: true, shippingMinor: true,
        totalMinor: true, shippingMethod: true, shippingCountryCode: true,
        pickupLocationSnapshot: true, createdAt: true, updatedAt: true,
        items: { select: { productIdSnapshot: true, skuSnapshot: true, titleSnapshot: true, sizeSnapshot: true, unitPriceMinor: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listForAdmin() {
    return this.prisma.user.findMany({ select: safeUserSelect, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async updateForAdmin(actor: AuthUser, targetId: string, input: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User not found');
    const targetIsAdmin = target.role === Role.ADMIN || target.role === Role.SUPER_ADMIN;
    const promotesToAdmin = input.role === Role.ADMIN || input.role === Role.SUPER_ADMIN;
    const managesAdmin = targetIsAdmin || promotesToAdmin;
    if (managesAdmin && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('SUPER_ADMIN is required to manage administrators');
    }
    if (actor.role === Role.SUPER_ADMIN && (input.role !== undefined || input.isActive !== undefined)) {
      const operator = await this.prisma.user.findUnique({
        where: { id: actor.userId }, select: { passwordHash: true },
      });
      if (!operator || !input.currentPassword || !(await argon2.verify(operator.passwordHash, input.currentPassword))) {
        throw new ForbiddenException('Current super-admin password is required');
      }
    }
    if (target.role === Role.SUPER_ADMIN && target.id === actor.userId && input.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own super-admin account');
    }
    if (target.role === Role.SUPER_ADMIN && target.id === actor.userId && input.role && input.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You cannot demote your own super-admin account');
    }
    const changes = {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    const user = await this.prisma.user.update({ where: { id: targetId }, data: changes, select: safeUserSelect });
    if (input.role !== undefined || input.isActive === false) {
      await this.prisma.authSession.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'admin_access_changed' },
      });
    }
    await this.audit.record(actor.userId, 'USER_ADMIN_UPDATED', 'User', targetId, {
      role: user.role, isActive: user.isActive,
    });
    return user;
  }

  async deleteForSuperAdmin(actor: AuthUser, targetId: string, input: AdminDeleteUserDto) {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('SUPER_ADMIN is required to delete users');
    }
    if (actor.userId === targetId) {
      throw new ForbiddenException('You cannot delete your own super-admin account');
    }
    const [operator, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: actor.userId }, select: { passwordHash: true } }),
      this.prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, email: true, role: true },
      }),
    ]);
    if (!target) throw new NotFoundException('User not found');
    if (!operator || !(await argon2.verify(operator.passwordHash, input.currentPassword))) {
      throw new ForbiddenException('Current super-admin password is required');
    }
    if (target.role === Role.SUPER_ADMIN) {
      const remaining = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isActive: true, id: { not: targetId } },
      });
      if (remaining < 1) throw new ForbiddenException('At least one active SUPER_ADMIN must remain');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const orderCount = await tx.order.count({ where: { userId: targetId } });
      await tx.authSession.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'admin_user_deleted' },
      });
      await tx.authToken.deleteMany({ where: { userId: targetId } });
      await tx.address.deleteMany({ where: { userId: targetId } });
      const cart = await tx.cart.findUnique({ where: { userId: targetId }, select: { id: true } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.delete({ where: { id: cart.id } });
      }
      if (orderCount > 0) {
        await tx.user.update({
          where: { id: targetId },
          data: {
            email: `deleted-${targetId}@deleted.yo.local`,
            firstName: 'Deleted',
            lastName: 'User',
            phone: null,
            isActive: false,
            role: Role.USER,
            failedLoginAttempts: 0,
            lockedUntil: null,
            adminMfaSecret: null,
            adminMfaEnabled: false,
          },
        });
        return { mode: 'anonymized' as const, orderCount };
      }
      await tx.user.delete({ where: { id: targetId } });
      return { mode: 'deleted' as const, orderCount };
    });

    await this.audit.record(actor.userId, 'USER_ADMIN_DELETED', 'User', targetId, {
      email: target.email,
      role: target.role,
      mode: result.mode,
      orderCount: result.orderCount,
    });
    return result;
  }
}
