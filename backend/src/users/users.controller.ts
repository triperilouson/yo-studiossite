import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { AddressDto } from './dto/address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('account')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() @ApiOperation({ summary: 'Get own profile' })
  profile(@CurrentUser() user: AuthUser) { return this.users.profile(user.userId); }

  @Patch() @ApiOperation({ summary: 'Update own profile' })
  update(@CurrentUser() user: AuthUser, @Body() input: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, input);
  }

  @Get('addresses') @ApiOperation({ summary: 'List own addresses' })
  addresses(@CurrentUser() user: AuthUser) { return this.users.listAddresses(user.userId); }

  @Post('addresses') @ApiOperation({ summary: 'Create an address' })
  createAddress(@CurrentUser() user: AuthUser, @Body() input: AddressDto) {
    return this.users.createAddress(user.userId, input);
  }

  @Patch('addresses/:id') @ApiOperation({ summary: 'Update an owned address' })
  updateAddress(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: AddressDto) {
    return this.users.updateAddress(user.userId, id, input);
  }

  @Delete('addresses/:id') @HttpCode(204) @ApiOperation({ summary: 'Delete an owned address' })
  deleteAddress(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.deleteAddress(user.userId, id);
  }

  @Get('orders') @ApiOperation({ summary: 'Get own order history' })
  orders(@CurrentUser() user: AuthUser) { return this.users.orderHistory(user.userId); }
}
