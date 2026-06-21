import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminOrderStatusDto } from './dto/admin-order.dto';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('admin-orders')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get() @ApiOperation({ summary: 'List orders (admin)' })
  list() { return this.orders.listForAdmin(); }
  @Patch(':id/status') @ApiOperation({ summary: 'Update fulfillment status; payment outcomes are forbidden' })
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: AdminOrderStatusDto) {
    return this.orders.updateStatusForAdmin(actor.userId, id, input.status);
  }
}
