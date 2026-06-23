import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { ShippingSelectionDto } from './dto/shipping.dto';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}
  @Public() @Get('options') options() { return this.shipping.publicOptions(); }
  @Post('quote') quote(@CurrentUser() user: AuthUser, @Body() input: ShippingSelectionDto) {
    return this.shipping.quote(user.userId, input);
  }
}
