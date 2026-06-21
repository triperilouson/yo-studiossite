import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional,
  IsString, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class CreateVariantDto {
  @IsString() @Length(1, 64) sku!: string;
  @IsString() @Length(1, 20) size!: string;
  @IsInt() @Min(0) @Max(100_000_000) priceMinor!: number;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsInt() @Min(0) @Max(1_000_000) stock!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ProductImageDto {
  @IsString() @Matches(/^(?:https?:\/\/|\/)/)
  @MaxLength(2048)
  url!: string;

  @IsString() @MaxLength(300) alt!: string;
  @IsInt() @Min(0) @Max(1000) position!: number;
}

export class CreateProductDto {
  @IsString() @Length(2, 120) title!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
  @IsString() @Length(1, 80) category!: string;
  @IsOptional() @IsString() @MaxLength(100) season?: string;
  @IsString() @Length(1, 5000) description!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ProductImageDto)
  images!: ProductImageDto[];
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @Length(2, 120) title?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @IsOptional() @IsString() @Length(1, 80) category?: string;
  @IsOptional() @IsString() @MaxLength(100) season?: string;
  @IsOptional() @IsString() @Length(1, 5000) description?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ProductImageDto)
  images?: ProductImageDto[];
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}

export class UpdateInventoryDto {
  @IsInt() @Min(0) @Max(1_000_000) stock!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) priceMinor?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
