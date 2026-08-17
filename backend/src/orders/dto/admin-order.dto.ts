import { IsEnum } from 'class-validator';
import { OrderFulfillmentStatus, OrderStatus } from '@prisma/client';

export class AdminOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class AdminOrderFulfillmentDto {
  @IsEnum(OrderFulfillmentStatus)
  fulfillmentStatus!: OrderFulfillmentStatus;
}

