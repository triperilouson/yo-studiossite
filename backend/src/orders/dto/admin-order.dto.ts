import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class AdminOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

