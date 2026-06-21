import { Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('orders/:orderId/session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a provider payment session for an owned order' })
  create(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.createSession(user.userId, orderId);
  }

  @Public()
  @Post('webhooks/grow')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive and verify an idempotent Grow webhook' })
  webhook(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.payments.receiveWebhook(request.rawBody, headers);
  }
}
