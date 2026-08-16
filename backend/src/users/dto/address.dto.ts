import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class AddressDto {
  @IsString() @Length(1, 40) label!: string;
  @IsString() @Length(2, 120) fullName!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/) phone!: string;
  @IsString() @Matches(/^[A-Z]{2}$/) country!: string;
  @IsOptional() @IsString() @Length(1, 120) state?: string;
  @IsString() @Length(1, 120) city!: string;
  @IsString() @Length(2, 30) postalCode!: string;
  @IsString() @Length(2, 200) line1!: string;
  @IsOptional() @IsString() @Length(1, 200) line2?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
