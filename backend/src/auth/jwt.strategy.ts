import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Environment } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user';

interface JwtPayload { sub: string; sid: string; email: string; role: Role }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Environment, true>, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() },
      },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });
    if (!session?.user.isActive) throw new UnauthorizedException();
    if (session.lastSeenAt < new Date(Date.now() - 5 * 60_000)) {
      void this.prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null }, data: { lastSeenAt: new Date() },
      });
    }
    return {
      userId: session.user.id, sessionId: session.id,
      email: session.user.email, role: session.user.role,
    };
  }
}
