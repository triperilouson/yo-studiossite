import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUrl, Length, MaxLength,
} from 'class-validator';
import { MarketingCampaignAudience } from '@prisma/client';

export class SubscribeDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsBoolean() drops?: boolean;
  @IsOptional() @IsBoolean() insiders?: boolean;
  @IsBoolean() consentAccepted!: boolean;
}

export class CreateMarketingCampaignDto {
  @IsEnum(MarketingCampaignAudience)
  audience!: MarketingCampaignAudience;

  @IsString() @Length(3, 180)
  subject!: string;

  @IsString() @Length(2, 160)
  title!: string;

  @IsString() @Length(10, 5000)
  body!: string;

  @IsOptional() @IsString() @MaxLength(80)
  ctaLabel?: string;

  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(2048)
  ctaUrl?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsUrl({ require_tld: false }, { each: true })
  imageUrls?: string[];
}
