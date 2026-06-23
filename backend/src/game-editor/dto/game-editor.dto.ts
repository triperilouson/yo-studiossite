import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export const gameAssetCategories = [
  'clothing', 'furniture', 'sewing', 'walls', 'floor', 'decor', 'machines',
  'lights', 'staff-only', 'checkout', 'characters', 'spritesheet',
] as const;

export class PointDto {
  @IsNumber() @Min(-8192) @Max(8192) x!: number;
  @IsNumber() @Min(-8192) @Max(8192) y!: number;
}

export class MaskPolygonDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(256) @ValidateNested({ each: true }) @Type(() => PointDto)
  points!: PointDto[];
  @IsOptional() @IsNumber() @Min(1) @Max(256) brushSize?: number;
}

export class CollisionMaskDto extends MaskPolygonDto {
  @IsIn(['barrier']) type!: 'barrier';
}

export class StairsZoneDto extends MaskPolygonDto {
  @IsIn(['stairsUp', 'stairsDown']) type!: 'stairsUp' | 'stairsDown';
  @IsNumber() @Min(-4096) @Max(4096) heightStart!: number;
  @IsNumber() @Min(-4096) @Max(4096) heightEnd!: number;
  @IsNumber() @Min(0.01) @Max(20) slopeStrength!: number;
  @ValidateNested() @Type(() => PointDto) direction!: PointDto;
}

export class AssetConfigDto {
  @IsString() @MinLength(1) @MaxLength(100) assetId!: string;
  @IsString() @MaxLength(500) image!: string;
  @IsInt() @Min(1) @Max(4096) width!: number;
  @IsInt() @Min(1) @Max(4096) height!: number;
  @ValidateNested() @Type(() => PointDto) anchor!: PointDto;
  @IsArray() @ArrayMaxSize(32) @ValidateNested({ each: true }) @Type(() => PointDto) depthBaseline!: PointDto[];
  @IsArray() @ArrayMaxSize(64) @ValidateNested({ each: true }) @Type(() => CollisionMaskDto) collisionMasks!: CollisionMaskDto[];
  @IsArray() @ArrayMaxSize(32) @ValidateNested({ each: true }) @Type(() => StairsZoneDto) stairsZones!: StairsZoneDto[];
  @IsArray() @ArrayMaxSize(64) @ValidateNested({ each: true }) @Type(() => MaskPolygonDto) occlusionMasks!: MaskPolygonDto[];
  @IsArray() @ArrayMaxSize(64) @ValidateNested({ each: true }) @Type(() => MaskPolygonDto) walkableMasks!: MaskPolygonDto[];
  @IsOptional() @IsBoolean() allowFlipX?: boolean;
  @IsOptional() @IsBoolean() allowFlipY?: boolean;
}

export class UploadGameAssetDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsIn(gameAssetCategories) category!: (typeof gameAssetCategories)[number];
  @IsString() @MaxLength(1_000_000)
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
  imageBase64!: string;
}

export class SaveAssetConfigDto {
  @ValidateNested() @Type(() => AssetConfigDto) config!: AssetConfigDto;
  @IsOptional() @IsUUID() productId?: string | null;
}

export class LevelObjectDto {
  @IsString() @MinLength(1) @MaxLength(100) id!: string;
  @IsString() @MinLength(1) @MaxLength(100) assetId!: string;
  @IsNumber() @Min(-8192) @Max(8192) x!: number;
  @IsNumber() @Min(-8192) @Max(8192) y!: number;
  @IsNumber() @Min(-4096) @Max(4096) z!: number;
  @IsNumber() @Min(-360) @Max(360) rotation!: number;
  @IsNumber() @Min(0.05) @Max(20) scaleX!: number;
  @IsNumber() @Min(0.05) @Max(20) scaleY!: number;
  @IsBoolean() flipX!: boolean;
  @IsBoolean() flipY!: boolean;
  @IsString() @MinLength(1) @MaxLength(40) layer!: string;
  @IsNumber() @Min(-8192) @Max(8192) depthOffset!: number;
  @IsBoolean() locked!: boolean;
  @IsOptional() @IsString() @MaxLength(100) groupId?: string;
}

export class SaveGameLevelDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(80) slug!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsInt() @Min(320) @Max(8192) width!: number;
  @IsInt() @Min(180) @Max(8192) height!: number;
  @IsBoolean() isActive!: boolean;
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => LevelObjectDto)
  objects!: LevelObjectDto[];
}
