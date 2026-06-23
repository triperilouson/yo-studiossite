import { Module } from '@nestjs/common';
import { AdminShippingController } from './admin-shipping.controller';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({ controllers: [ShippingController, AdminShippingController], providers: [ShippingService], exports: [ShippingService] })
export class ShippingModule {}
