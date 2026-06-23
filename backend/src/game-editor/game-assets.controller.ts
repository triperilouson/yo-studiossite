import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { GameEditorService } from './game-editor.service';

@Public()
@Controller('game-assets')
export class GameAssetsController {
  constructor(private readonly editor: GameEditorService) {}

  @Get('runtime/product-links') productLinks() { return this.editor.runtimeProductLinks(); }

  @Get(':id/image')
  async image(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    const asset = await this.editor.image(id);
    return reply
      .header('Content-Type', asset.mimeType)
      .header('Cache-Control', 'public, max-age=3600, must-revalidate')
      .header('Last-Modified', asset.updatedAt.toUTCString())
      .send(Buffer.from(asset.imageData));
  }

  @Get('levels/active') activeLevel() { return this.editor.activeLevel(); }
}
