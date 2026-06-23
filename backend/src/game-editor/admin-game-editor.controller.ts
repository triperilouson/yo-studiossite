import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { SaveAssetConfigDto, SaveGameLevelDto, UploadGameAssetDto } from './dto/game-editor.dto';
import { GameEditorService } from './game-editor.service';

@Roles(Role.SUPER_ADMIN)
@Controller('admin/game-editor')
export class AdminGameEditorController {
  constructor(private readonly editor: GameEditorService) {}

  @Get('assets') assets() { return this.editor.listAssets(); }
  @Post('assets') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  upload(@CurrentUser() actor: AuthUser, @Body() input: UploadGameAssetDto) { return this.editor.upload(actor.userId, input); }
  @Patch('assets/:id/config') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  saveConfig(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: SaveAssetConfigDto) {
    return this.editor.saveConfig(actor.userId, id, input);
  }
  @Delete('assets/:id') @HttpCode(204)
  async remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { await this.editor.remove(actor.userId, id); }

  @Get('levels') levels() { return this.editor.listLevels(); }
  @Post('levels') @Throttle({ default: { limit: 30, ttl: 60_000 } })
  saveLevel(@CurrentUser() actor: AuthUser, @Body() input: SaveGameLevelDto) { return this.editor.saveLevel(actor.userId, input); }
}
