import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import type { Environment } from '../config/env';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CompleteAdminMfaDto } from './dto/admin-mfa.dto';

const REFRESH_COOKIE = 'yo_refresh';

interface CookieRequest extends FastifyRequest {
  cookies: Record<string, string | undefined>;
}

interface RefreshCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  domain?: string;
  maxAge?: number;
}

type CookieReply = FastifyReply & {
  setCookie(
    name: string,
    value: string,
    options?: RefreshCookieOptions,
  ): FastifyReply;

  clearCookie(
    name: string,
    options?: RefreshCookieOptions,
  ): FastifyReply;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a customer account' })
  async register(@Body() input: RegisterDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: CookieReply) {
    const result = await this.auth.register(input, this.context(req));
    this.setRefreshCookie(reply, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login and create a refresh session' })
  async login(@Body() input: LoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: CookieReply) {
    const result = await this.auth.login(input, this.context(req));
    if ('mfaRequired' in result) return result;
    this.setRefreshCookie(reply, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('admin-mfa/complete')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async completeAdminMfa(@Body() input: CompleteAdminMfaDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: CookieReply) {
    const result = await this.auth.completeAdminMfa(input.challengeToken, input.code, this.context(req));
    this.setRefreshCookie(reply, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate refresh token and issue an access token' })
  async refresh(@Req() req: CookieRequest, @Res({ passthrough: true }) reply: CookieReply) {
    const result = await this.auth.refresh(req.cookies[REFRESH_COOKIE], this.context(req));
    this.setRefreshCookie(reply, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) reply: CookieReply): Promise<void> {
    await this.auth.logout(req.cookies[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request password reset without revealing account existence' })
  @ApiResponse({ status: 202 })
  async requestPasswordReset(@Body() input: RequestPasswordResetDto): Promise<void> {
    await this.auth.requestPasswordReset(input.email);
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password and revoke every user session' })
  async resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(input);
  }

  @Public()
  @Post('email/verify')
  @HttpCode(204)
  @ApiOperation({ summary: 'Verify an email using a one-time token' })
  async verifyEmail(@Body() input: VerifyEmailDto): Promise<void> {
    await this.auth.verifyEmail(input.token);
  }

  private setRefreshCookie(reply: CookieReply, token: string): void {
    reply.setCookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400,
    });
  }

  private cookieOptions(): RefreshCookieOptions {
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict' as const,
      path: '/api/v1/auth',
      ...(domain ? { domain } : {}),
    };
  }

  private context(req: FastifyRequest) {
    const userAgent = req.headers['user-agent'];
    return { ip: req.ip, ...(userAgent ? { userAgent } : {}) };
  }
}
