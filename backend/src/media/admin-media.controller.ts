import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { AdminAuditService } from '../common/admin-audit.service';
import { UploadImageDto } from './dto/upload-image.dto';
import { MediaService } from './media.service';

@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/media')
export class AdminMediaController {
  constructor(
    private readonly media: MediaService,
    private readonly audit: AdminAuditService,
  ) {}

  @Post('images')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async uploadImage(@CurrentUser() actor: AuthUser, @Body() input: UploadImageDto) {
    const uploaded = await this.media.uploadImage(input);
    await this.audit.record(actor.userId, 'IMAGE_UPLOADED', 'MediaObject', uploaded.key, {
      scope: input.scope,
      ownerSlug: input.ownerSlug,
      byteSize: uploaded.byteSize,
    });
    return uploaded;
  }
}
