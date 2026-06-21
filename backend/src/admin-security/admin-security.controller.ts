import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { AdminSecurityService } from './admin-security.service';
import { UpdateSecuritySettingsDto } from './dto/security-settings.dto';
import { AdminMfaPasswordDto, ConfirmAdminMfaDto } from '../auth/dto/admin-mfa.dto';

@ApiTags('admin-security')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/security')
export class AdminSecurityController {
  constructor(private readonly security: AdminSecurityService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Security and commerce dashboard metrics' })
  overview() { return this.security.overview(); }

  @Get('settings')
  settings() { return this.security.settings(); }

  @Get('audit')
  audit() { return this.security.auditLog(); }

  @Get('sessions')
  sessions(@CurrentUser() actor: AuthUser) {
    return this.security.sessions(actor.userId, actor.sessionId);
  }

  @Delete('sessions/:id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  revokeSession(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.security.revokeSession(actor.userId, actor.sessionId, id);
  }

  @Post('sessions/revoke-others')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  revokeOtherSessions(@CurrentUser() actor: AuthUser) {
    return this.security.revokeOtherSessions(actor.userId, actor.sessionId);
  }

  @Post('mfa/enroll')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  enrollMfa(@CurrentUser() actor: AuthUser, @Body() input: AdminMfaPasswordDto) {
    return this.security.beginMfaEnrollment(actor.userId, input.currentPassword);
  }

  @Post('mfa/confirm')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  confirmMfa(@CurrentUser() actor: AuthUser, @Body() input: ConfirmAdminMfaDto) {
    return this.security.confirmMfaEnrollment(actor.userId, input.currentPassword, input.code);
  }

  @Post('mfa/disable')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  disableMfa(@CurrentUser() actor: AuthUser, @Body() input: ConfirmAdminMfaDto) {
    return this.security.disableMfa(actor.userId, input.currentPassword, input.code);
  }

  @Patch('settings')
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  updateSettings(@CurrentUser() actor: AuthUser, @Body() input: UpdateSecuritySettingsDto) {
    return this.security.updateSettings(actor.userId, input.registrationEnabled);
  }
}
