import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { AdminUpdateUserDto } from './dto/admin-user.dto';
import { UsersService } from './users.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get() @ApiOperation({ summary: 'List users (admin)' })
  list() { return this.users.listForAdmin(); }

  @Patch(':id') @ApiOperation({ summary: 'Manage a user; administrators require SUPER_ADMIN' })
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() input: AdminUpdateUserDto) {
    return this.users.updateForAdmin(actor, id, input);
  }
}
