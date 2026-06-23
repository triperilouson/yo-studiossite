import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';
import { ShippingMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { DeliveryAddressDto } from '../../shipping/dto/shipping.dto';

export class CheckoutDto {
  @IsString() @Length(1, 80) firstName!: string;
  @IsString() @Length(1, 80) lastName!: string;
  @IsEmail() @Length(3, 254) email!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/) phone!: string;

  @IsEnum(ShippingMethod)
  method!: ShippingMethod;

  @IsOptional() @IsUUID()
  addressId?: string;

  @IsOptional() @ValidateNested() @Type(() => DeliveryAddressDto)
  address?: DeliveryAddressDto;

  @IsOptional() @IsUUID()
  pickupLocationId?: string;
}
