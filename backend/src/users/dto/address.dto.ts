import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class AddressDto {
  @IsString() @Length(1, 40) label!: string;
  @IsString() @Length(2, 120) fullName!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/) phone!: string;
  @IsString() @Matches(/^[A-Za-z]{2}$/) country!: string;
  @IsOptional() @IsString() @Length(1, 100) state?: string;
  @IsString() @Length(1, 100) city!: string;
  @IsString() @Length(1, 20) postalCode!: string;
  @IsString() @Length(1, 160) line1!: string;
  @IsOptional() @IsString() @Length(1, 160) line2?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
