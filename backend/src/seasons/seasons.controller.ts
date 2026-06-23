import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SeasonsService } from './seasons.service';

@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  @Public() @Get()
  list(@Query('archive') archive?: string) { return this.seasons.listPublic(archive === 'true'); }

  @Public() @Get('featured/current')
  featured() { return this.seasons.featured(); }

  @Public() @Get('preview/:slug')
  preview(@Param('slug') slug: string, @Query('token') token?: string) { return this.seasons.preview(slug, token); }

  @Public() @Get(':slug')
  get(@Param('slug') slug: string) { return this.seasons.getPublic(slug); }
}
