import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSupportThreadDto, InboundSupportEmailDto, SupportReplyDto } from './dto/support.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Public()
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a customer support thread' })
  create(@Body() input: CreateSupportThreadDto) {
    return this.support.createThread(input);
  }

  @Public()
  @Post('inbound')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Receive parsed inbound support email from an email provider webhook' })
  inbound(@Headers('x-yo-support-secret') secret: string | undefined, @Body() input: InboundSupportEmailDto) {
    return this.support.receiveInbound(secret, input);
  }
}

@ApiTags('admin-support')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('threads')
  @ApiOperation({ summary: 'List support threads' })
  list() {
    return this.support.listForAdmin();
  }

  @Post('threads/:id/reply')
  @ApiOperation({ summary: 'Reply to a support thread by email' })
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() input: SupportReplyDto) {
    return this.support.reply(id, input);
  }
}
