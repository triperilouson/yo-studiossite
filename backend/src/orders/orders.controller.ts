import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CheckoutDto } from './dto/checkout.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post('checkout')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Atomically create an order from the authenticated cart' })
  checkout(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body() input: CheckoutDto,
  ) {
    if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
      throw new BadRequestException('Idempotency-Key must contain 16-128 safe characters');
    }
    return this.orders.checkout(user.userId, input, key);
  }
  @Get(':id') @ApiOperation({ summary: 'Get an owned order' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getOwned(user.userId, id);
  }
}
