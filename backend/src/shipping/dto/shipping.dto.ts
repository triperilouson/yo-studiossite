import {
  IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { ShippingMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class DeliveryAddressDto {
  @IsOptional() @IsString() @Length(1, 80) label?: string;
  @IsString() @Length(2, 120) fullName!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/) phone!: string;
  @IsString() @Matches(/^[A-Z]{2}$/) country!: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsString() @Length(1, 120) city!: string;
  @IsString() @Length(2, 30) postalCode!: string;
  @IsString() @Length(2, 200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
}

export class ShippingSelectionDto {
  @IsEnum(ShippingMethod) method!: ShippingMethod;
  @IsOptional() @IsUUID() addressId?: string;
  @IsOptional() @ValidateNested() @Type(() => DeliveryAddressDto) address?: DeliveryAddressDto;
  @IsOptional() @IsUUID() pickupLocationId?: string;
}

export class CreateShippingCountryDto {
  @IsString() @Matches(/^[A-Z]{2}$/) code!: string;
  @IsString() @Length(2, 100) name!: string;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsInt() @Min(0) @Max(100_000_000) priceMinor!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) freeThresholdMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) minOrderMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) maxOrderMinor?: number;
  @IsInt() @Min(0) @Max(365) estimatedMinDays!: number;
  @IsInt() @Min(0) @Max(365) estimatedMaxDays!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
}

export class UpdateShippingCountryDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) priceMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) freeThresholdMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) minOrderMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) maxOrderMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) estimatedMinDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) estimatedMaxDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
}

export class CreatePickupLocationDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Matches(/^[A-Z]{2}$/) country!: string;
  @IsString() @Length(1, 120) city!: string;
  @IsString() @Length(2, 300) address!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
}

export class UpdatePickupLocationDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]{2}$/) country?: string;
  @IsOptional() @IsString() @Length(1, 120) city?: string;
  @IsOptional() @IsString() @Length(2, 300) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
}
