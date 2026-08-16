import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const imageUploadScopes = ['products', 'seasons', 'site'] as const;

export class UploadImageDto {
  @IsIn(imageUploadScopes)
  scope!: (typeof imageUploadScopes)[number];

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  ownerSlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fileName?: string;

  @IsString()
  @MaxLength(12_000_000)
  @Matches(/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/)
  imageBase64!: string;
}
