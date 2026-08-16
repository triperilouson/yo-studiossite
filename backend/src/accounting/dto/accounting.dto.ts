import { Type } from 'class-transformer';
import {
  IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min,
} from 'class-validator';
import { ReceiptPaymentMethod } from '@prisma/client';

export class CreateReceiptDto {
  @IsString() @Length(2, 160) customerName!: string;
  @IsOptional() @IsEmail() @MaxLength(254) customerEmail?: string;
  @IsOptional() @IsString() @MaxLength(300) payerAddress?: string;
  @IsInt() @Min(1) @Max(100_000_000) amountMinor!: number;
  @IsString() @Length(3, 3) currency!: string;
  @IsString() @Length(2, 500) description!: string;
  @IsEnum(ReceiptPaymentMethod) paymentMethod!: ReceiptPaymentMethod;
  @IsOptional() @IsString() @MaxLength(200) paymentReference?: string;
  @IsOptional() @IsDateString() issuedAt?: string;
  @IsOptional() @IsDateString() electronicDocsConsentAt?: string;
  @IsOptional() @IsString() @MaxLength(120) electronicDocsConsentSource?: string;
}

export class ReceiptQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000) skip = 0;
}

export class SendReceiptDto {
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}

export class CancelReceiptDto {
  @IsString() @Length(3, 500) reason!: string;
}
