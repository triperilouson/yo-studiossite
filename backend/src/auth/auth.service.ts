import { randomBytes, createHmac } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { AuthTokenType, Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Environment } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/password-reset.dto';
import { AdminAuditService } from '../common/admin-audit.service';
import { AdminMfaService } from './admin-mfa.service';

interface ClientContext { ip: string; userAgent?: string }
interface IssuedTokens { accessToken: string; refreshToken: string; expiresIn: string }

const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  emailVerifiedAt: true,
  adminMfaEnabled: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = argon2.hash(randomBytes(32), { type: argon2.argon2id });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
    private readonly audit: AdminAuditService,
    private readonly mfa: AdminMfaService,
  ) {}

  async register(input: RegisterDto, context: ClientContext) {
    const settings = await this.prisma.storeSettings.findUnique({ where: { id: 1 } });
    if (settings && !settings.registrationEnabled) {
      throw new ServiceUnavailableException('Registration is temporarily unavailable');
    }
    const email = input.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          cart: { create: {} },
        },
        select: publicUserSelect,
      });
      await this.createOneTimeToken(user.id, AuthTokenType.EMAIL_VERIFICATION, 24 * 60);
      return { user, ...(await this.issueSession(user, context)) };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(input: LoginDto, context: ClientContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    const verificationHash = user?.passwordHash ?? await this.dummyPasswordHash;
    const valid = await argon2.verify(verificationHash, input.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked');
    }
    if (!valid || !user.isActive) {
      if (user.isActive) {
        const threshold = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN ? 5 : 10;
        const failedLoginAttempts = user.failedLoginAttempts + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts,
            ...(failedLoginAttempts >= threshold
              ? { lockedUntil: new Date(Date.now() + 15 * 60_000), failedLoginAttempts: 0 }
              : {}),
          },
        });
        if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
          await this.audit.record(user.id, 'ADMIN_LOGIN_FAILED', 'User', user.id, {
            locked: failedLoginAttempts >= threshold,
          });
        }
      }
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.failedLoginAttempts || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    const safeUser = {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      phone: user.phone, role: user.role, emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt, updatedAt: user.updatedAt, adminMfaEnabled: user.adminMfaEnabled,
    };
    if ((user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) && user.adminMfaEnabled) {
      const challengeToken = await this.createOneTimeToken(user.id, AuthTokenType.ADMIN_MFA, 5);
      await this.audit.record(user.id, 'ADMIN_MFA_CHALLENGE_CREATED', 'AuthToken');
      return { mfaRequired: true as const, challengeToken, user: safeUser };
    }
    const result = { user: safeUser, ...(await this.issueSession(user, context)) };
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      await this.audit.record(user.id, 'ADMIN_LOGIN', 'AuthSession');
    }
    return result;
  }

  async completeAdminMfa(challengeToken: string, code: string, context: ClientContext) {
    const token = await this.verifyOneTimeToken(challengeToken, AuthTokenType.ADMIN_MFA);
    const user = await this.prisma.user.findUnique({ where: { id: token.userId } });
    if (!user?.isActive || !user.adminMfaEnabled || !user.adminMfaSecret) {
      throw new UnauthorizedException('Invalid MFA challenge');
    }
    if (!this.mfa.verify(this.mfa.decrypt(user.adminMfaSecret), code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    const consumed = await this.prisma.authToken.updateMany({
      where: { id: token.id, usedAt: null }, data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('MFA challenge already used');
    const safeUser = {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      phone: user.phone, role: user.role, emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt, updatedAt: user.updatedAt, adminMfaEnabled: true,
    };
    await this.audit.record(user.id, 'ADMIN_MFA_LOGIN_COMPLETED', 'AuthToken', token.id);
    return { user: safeUser, ...(await this.issueSession(user, context)) };
  }

  async refresh(rawToken: string | undefined, context: ClientContext): Promise<IssuedTokens> {
    const parsed = this.parseRefreshToken(rawToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });
    if (!session || !(await argon2.verify(session.refreshTokenHash, parsed.secret))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.revokedAt) {
      await this.revokeAllSessions(session.userId, 'refresh_token_reuse');
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (session.expiresAt <= new Date() || !session.user.isActive) {
      await this.revokeSession(session.id, 'expired_or_inactive');
      throw new UnauthorizedException('Refresh token expired');
    }

    const secret = randomBytes(32).toString('base64url');
    const refreshTokenHash = await argon2.hash(secret, { type: argon2.argon2id });
    const expiresAt = this.refreshExpiry();
    const next = await this.prisma.$transaction(async (tx) => {
      const created = await tx.authSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash,
          expiresAt,
          userAgent: context.userAgent?.slice(0, 500),
          ipHash: this.hashIp(context.ip),
        },
      });
      const revoked = await tx.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'rotated', rotatedToId: created.id },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Session already rotated');
      return created;
    });
    return this.createTokenResponse(session.user, next.id, `${next.id}.${secret}`);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    try {
      const parsed = this.parseRefreshToken(rawToken);
      const session = await this.prisma.authSession.findUnique({ where: { id: parsed.sessionId } });
      if (session && await argon2.verify(session.refreshTokenHash, parsed.secret)) {
        await this.revokeSession(session.id, 'logout');
      }
    } catch {
      // Logout remains idempotent and reveals no token information.
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }, select: { id: true },
    });
    if (user) {
      await this.createOneTimeToken(user.id, AuthTokenType.PASSWORD_RESET, 30);
    } else {
      await argon2.verify(await this.dummyPasswordHash, randomBytes(32));
    }
  }

  async resetPassword(input: ResetPasswordDto): Promise<void> {
    const token = await this.verifyOneTimeToken(input.token, AuthTokenType.PASSWORD_RESET);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
      this.prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'password_reset' },
      }),
    ]);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const token = await this.verifyOneTimeToken(rawToken, AuthTokenType.EMAIL_VERIFICATION);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    ]);
  }

  private async issueSession(user: { id: string; email: string; role: Role }, context: ClientContext) {
    const secret = randomBytes(32).toString('base64url');
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: await argon2.hash(secret, { type: argon2.argon2id }),
        expiresAt: this.refreshExpiry(),
        userAgent: context.userAgent?.slice(0, 500),
        ipHash: this.hashIp(context.ip),
      },
    });
    return this.createTokenResponse(user, session.id, `${session.id}.${secret}`);
  }

  private async createTokenResponse(
    user: { id: string; email: string; role: Role },
    sessionId: string,
    refreshToken: string,
  ): Promise<IssuedTokens> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, email: user.email, role: user.role },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        algorithm: 'HS256',
        expiresIn: expiresIn as JwtSignOptions['expiresIn'],
      },
    );
    return { accessToken, refreshToken, expiresIn };
  }

  private async createOneTimeToken(userId: string, type: AuthTokenType, minutes: number): Promise<string> {
    const secret = randomBytes(32).toString('base64url');
    const token = await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: await argon2.hash(secret, { type: argon2.argon2id }),
        expiresAt: new Date(Date.now() + minutes * 60_000),
      },
    });
    return `${token.id}.${secret}`;
  }

  private async verifyOneTimeToken(rawToken: string, type: AuthTokenType) {
    const [id, secret, extra] = rawToken.split('.');
    if (!id || !secret || extra || !this.isUuid(id)) throw new UnauthorizedException('Invalid token');
    const token = await this.prisma.authToken.findFirst({ where: { id, type } });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!(await argon2.verify(token.tokenHash, secret))) throw new UnauthorizedException('Invalid token');
    return token;
  }

  private parseRefreshToken(rawToken: string | undefined): { sessionId: string; secret: string } {
    const [sessionId, secret, extra] = (rawToken ?? '').split('.');
    if (!sessionId || !secret || extra || !this.isUuid(sessionId)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { sessionId, secret };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000);
  }

  private hashIp(ip: string): string {
    return createHmac('sha256', this.config.get('JWT_ACCESS_SECRET', { infer: true }))
      .update(ip)
      .digest('hex');
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private async revokeSession(id: string, reason: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  private async revokeAllSessions(userId: string, reason: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason },
    });
  }
}
