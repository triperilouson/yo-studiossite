import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString,
  Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { SeasonStatus } from '@prisma/client';

export class SeasonImageDto {
  @IsString() @Matches(/^(?:https?:\/\/|\/)/) @MaxLength(2048) url!: string;
  @IsString() @Length(1, 300) alt!: string;
  @IsInt() @Min(0) @Max(1000) position!: number;
}

export class CreateSeasonDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
  @IsString() @Matches(/^S[A-Z0-9-]{1,19}$/) code!: string;
  @IsString() @Length(2, 120) title!: string;
  @IsString() @Length(1, 5000) description!: string;
  @IsOptional() @IsString() @MaxLength(2000) campaignText?: string;
  @IsOptional() @IsEnum(SeasonStatus) status?: SeasonStatus;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsDateString() releaseAt?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => SeasonImageDto) images!: SeasonImageDto[];
}

export class UpdateSeasonDto {
  @IsOptional() @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug?: string;
  @IsOptional() @IsString() @Matches(/^S[A-Z0-9-]{1,19}$/) code?: string;
  @IsOptional() @IsString() @Length(2, 120) title?: string;
  @IsOptional() @IsString() @Length(1, 5000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) campaignText?: string;
  @IsOptional() @IsEnum(SeasonStatus) status?: SeasonStatus;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsDateString() releaseAt?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => SeasonImageDto) images?: SeasonImageDto[];
}
