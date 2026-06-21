import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateProductDto, UpdateInventoryDto, UpdateProductDto } from './dto/admin-product.dto';
import { ProductsService } from './products.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { Throttle } from '@nestjs/throttler';

@ApiTags('admin-products')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get() @ApiOperation({ summary: 'List all products (admin)' })
  list() { return this.products.listForAdmin(); }
  @Post() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @ApiOperation({ summary: 'Create product with variants' })
  create(@CurrentUser() actor: AuthUser, @Body() input: CreateProductDto) { return this.products.create(actor.userId, input); }
  @Patch(':id') @Throttle({ default: { limit: 30, ttl: 60_000 } }) @ApiOperation({ summary: 'Update product metadata/status' })
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateProductDto) {
    return this.products.update(actor.userId, id, input);
  }
  @Patch('variants/:id/inventory') @ApiOperation({ summary: 'Update stock and optional price' })
  inventory(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateInventoryDto) {
    return this.products.updateInventory(actor.userId, id, input);
  }
}
