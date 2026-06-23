import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { ShippingMethod } from '@prisma/client';

export class CheckoutDto {
  @IsString() @Length(1, 80) firstName!: string;
  @IsString() @Length(1, 80) lastName!: string;
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/) phone!: string;

  @IsEnum(ShippingMethod)
  method!: ShippingMethod;

  @IsOptional() @IsUUID()
  addressId?: string;

  @IsOptional() @IsUUID()
  pickupLocationId?: string;
}
