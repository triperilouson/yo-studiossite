import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import {
  CreatePickupLocationDto, CreateShippingCountryDto,
  UpdatePickupLocationDto, UpdateShippingCountryDto,
} from './dto/shipping.dto';
import { ShippingService } from './shipping.service';

@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/shipping')
export class AdminShippingController {
  constructor(private readonly shipping: ShippingService) {}
  @Get() list() { return this.shipping.adminOptions(); }
  @Post('countries') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createCountry(@CurrentUser() actor: AuthUser, @Body() input: CreateShippingCountryDto) {
    return this.shipping.createCountry(actor.userId, input);
  }
  @Patch('countries/:id')
  updateCountry(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateShippingCountryDto) {
    return this.shipping.updateCountry(actor.userId, id, input);
  }
  @Post('pickup-locations') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createPickup(@CurrentUser() actor: AuthUser, @Body() input: CreatePickupLocationDto) {
    return this.shipping.createPickup(actor.userId, input);
  }
  @Patch('pickup-locations/:id')
  updatePickup(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdatePickupLocationDto) {
    return this.shipping.updatePickup(actor.userId, id, input);
  }
}
