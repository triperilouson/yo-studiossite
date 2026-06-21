import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}
  @Get() @ApiOperation({ summary: 'Get own server-side cart' })
  get(@CurrentUser() user: AuthUser) { return this.cart.get(user.userId); }
  @Post('items') @ApiOperation({ summary: 'Add a product and size to own cart' })
  add(@CurrentUser() user: AuthUser, @Body() input: AddCartItemDto) { return this.cart.add(user.userId, input); }
  @Patch('items/:id') @ApiOperation({ summary: 'Change quantity of an owned cart item' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateCartItemDto) {
    return this.cart.update(user.userId, id, input.quantity);
  }
  @Delete('items/:id') @HttpCode(204) @ApiOperation({ summary: 'Remove an owned cart item' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.cart.remove(user.userId, id); }
  @Delete() @HttpCode(204) @ApiOperation({ summary: 'Clear own cart' })
  clear(@CurrentUser() user: AuthUser) { return this.cart.clear(user.userId); }
}
