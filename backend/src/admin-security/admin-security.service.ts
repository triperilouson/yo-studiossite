import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, ProductStatus } from '@prisma/client';
import { AdminAuditService } from '../common/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminMfaService } from '../auth/admin-mfa.service';
import * as argon2 from 'argon2';

@Injectable()
export class AdminSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly mfa: AdminMfaService,
  ) {}

  async overview() {
    const onlineSince = new Date(Date.now() - 15 * 60_000);
    const [
      users, activeUsers, lockedUsers, onlineSessions, activeProducts, pendingOrders,
      failedPayments, webhookErrors, variants, settings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
      this.prisma.authSession.groupBy({
        by: ['userId'],
        where: { revokedAt: null, expiresAt: { gt: new Date() }, lastSeenAt: { gte: onlineSince } },
      }),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING_PAYMENT } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      this.prisma.webhookEvent.count({ where: { processingError: { not: null } } }),
      this.prisma.productVariant.findMany({
        where: { isActive: true, product: { status: ProductStatus.ACTIVE } },
        select: { stock: true, reservedStock: true }, take: 2000,
      }),
      this.settings(),
    ]);
    return {
      users,
      activeUsers,
      lockedUsers,
      onlineUsers: onlineSessions.length,
      activeProducts,
      pendingOrders,
      failedPayments,
      webhookErrors,
      lowStockVariants: variants.filter(({ stock, reservedStock }) => stock - reservedStock <= 5).length,
      availableUnits: variants.reduce((sum, { stock, reservedStock }) => sum + Math.max(0, stock - reservedStock), 0),
      settings,
      onlineWindowMinutes: 15,
    };
  }

  settings() {
    return this.prisma.storeSettings.upsert({
      where: { id: 1 }, create: { id: 1 }, update: {},
      select: { registrationEnabled: true, updatedAt: true, updatedById: true },
    });
  }

  async updateSettings(actorId: string, registrationEnabled: boolean) {
    const settings = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1, registrationEnabled, updatedById: actorId },
      update: { registrationEnabled, updatedById: actorId },
      select: { registrationEnabled: true, updatedAt: true, updatedById: true },
    });
    await this.audit.record(actorId, 'REGISTRATION_TOGGLED', 'StoreSettings', '1', { registrationEnabled });
    return settings;
  }

  auditLog() {
    return this.prisma.adminAuditLog.findMany({
      select: {
        id: true, action: true, entityType: true, entityId: true,
        metadata: true, createdAt: true,
        actor: { select: { email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async sessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
    });
    return sessions.map((session) => ({ ...session, isCurrent: session.id === currentSessionId }));
  }

  async revokeSession(userId: string, currentSessionId: string, sessionId: string) {
    const result = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'admin_session_revoked' },
    });
    if (result.count) {
      await this.audit.record(userId, 'ADMIN_SESSION_REVOKED', 'AuthSession', sessionId, {
        currentSession: sessionId === currentSessionId,
      });
    }
    return { revoked: result.count === 1 };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const result = await this.prisma.authSession.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'admin_revoked_other_sessions' },
    });
    await this.audit.record(userId, 'ADMIN_OTHER_SESSIONS_REVOKED', 'AuthSession', undefined, {
      count: result.count,
    });
    return { revoked: result.count };
  }

  async beginMfaEnrollment(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is invalid');
    }
    if (user.adminMfaEnabled) throw new ForbiddenException('MFA is already enabled');
    const enrollment = this.mfa.generate(user.email);
    await this.prisma.user.update({
      where: { id: userId }, data: { adminMfaSecret: this.mfa.encrypt(enrollment.secret) },
    });
    await this.audit.record(userId, 'ADMIN_MFA_ENROLLMENT_STARTED', 'User', userId);
    return enrollment;
  }

  async confirmMfaEnrollment(userId: string, currentPassword: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is invalid');
    }
    if (!user.adminMfaSecret || !this.mfa.verify(this.mfa.decrypt(user.adminMfaSecret), code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { adminMfaEnabled: true } });
    await this.audit.record(userId, 'ADMIN_MFA_ENABLED', 'User', userId);
    return { enabled: true };
  }

  async disableMfa(userId: string, currentPassword: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is invalid');
    }
    if (!user.adminMfaSecret || !user.adminMfaEnabled || !this.mfa.verify(this.mfa.decrypt(user.adminMfaSecret), code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { adminMfaEnabled: false, adminMfaSecret: null } }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'admin_mfa_disabled' },
      }),
    ]);
    await this.audit.record(userId, 'ADMIN_MFA_DISABLED', 'User', userId);
    return { enabled: false };
  }
}
