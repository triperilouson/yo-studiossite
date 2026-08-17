import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CreateMarketingCampaignDto, SubscribeDto } from './dto/marketing.dto';
import { MarketingService } from './marketing.service';

@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Public()
  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Subscribe to marketing emails' })
  subscribe(@Body() input: SubscribeDto) {
    return this.marketing.subscribe(input);
  }
}

@ApiTags('admin-marketing')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin/marketing')
export class AdminMarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('campaigns')
  @ApiOperation({ summary: 'List marketing campaigns' })
  listCampaigns() {
    return this.marketing.listCampaigns();
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create a marketing campaign draft' })
  createCampaign(@CurrentUser() actor: AuthUser, @Body() input: CreateMarketingCampaignDto) {
    return this.marketing.createCampaign(actor.userId, input);
  }

  @Post('campaigns/:id/send')
  @HttpCode(202)
  @ApiOperation({ summary: 'Send a marketing campaign to opted-in recipients' })
  sendCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketing.sendCampaign(id);
  }
}
