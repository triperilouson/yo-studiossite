import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Role } from '@prisma/client';

export class AdminUpdateUserDto {
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @Length(12, 200) currentPassword?: string;
}

export class AdminDeleteUserDto {
  @IsString() @Length(12, 200) currentPassword!: string;
}
