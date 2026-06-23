import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CreateSeasonDto, UpdateSeasonDto } from './dto/season.dto';
import { SeasonsService } from './seasons.service';

@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/seasons')
export class AdminSeasonsController {
  constructor(private readonly seasons: SeasonsService) {}
  @Get() list() { return this.seasons.listAdmin(); }
  @Post() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() actor: AuthUser, @Body() input: CreateSeasonDto) {
    return this.seasons.create(actor.userId, input);
  }
  @Patch(':id') @Throttle({ default: { limit: 20, ttl: 60_000 } })
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateSeasonDto) {
    return this.seasons.update(actor.userId, id, input);
  }
  @Post(':id/preview-token') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  previewToken(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.seasons.rotatePreviewToken(actor.userId, id);
  }
}
