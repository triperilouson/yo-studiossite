import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminAuditService } from '../common/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetConfigDto, SaveAssetConfigDto, SaveGameLevelDto, UploadGameAssetDto } from './dto/game-editor.dto';

const assetSelect = {
  id: true, slug: true, name: true, category: true, mimeType: true, byteSize: true,
  width: true, height: true, config: true, isBuiltIn: true, productId: true,
  product: { select: { id: true, slug: true, title: true, status: true } },
  createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class GameEditorService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AdminAuditService) {}

  listAssets() {
    return this.prisma.gameAsset.findMany({ select: assetSelect, orderBy: [{ category: 'asc' }, { name: 'asc' }], take: 500 });
  }

  runtimeProductLinks() {
    return this.prisma.gameAsset.findMany({
      where: { productId: { not: null }, product: { status: 'ACTIVE' } },
      select: { slug: true, productId: true },
      orderBy: { slug: 'asc' },
      take: 500,
    });
  }

  async image(id: string) {
    const asset = await this.prisma.gameAsset.findUnique({ where: { id }, select: { imageData: true, mimeType: true, updatedAt: true } });
    if (!asset) throw new NotFoundException('Game asset not found');
    return asset;
  }

  async upload(actorId: string, input: UploadGameAssetDto) {
    const data = this.decodePng(input.imageBase64);
    const id = randomUUID();
    const slugBase = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';
    const slug = `${slugBase}-${id.slice(0, 8)}`;
    const imagePath = `/api/v1/game-assets/${id}/image`;
    const config = {
      assetId: id, image: imagePath, width: data.width, height: data.height,
      anchor: { x: Math.round(data.width / 2), y: data.height }, depthBaseline: [],
      collisionMasks: [], stairsZones: [], occlusionMasks: [], walkableMasks: [],
      allowFlipX: true, allowFlipY: false,
    } satisfies AssetConfigDto;
    const asset = await this.prisma.gameAsset.create({
      data: {
        id, slug, name: input.name.trim(), category: input.category, byteSize: data.buffer.length,
        width: data.width, height: data.height, imageData: data.buffer, config, createdById: actorId,
      }, select: assetSelect,
    });
    await this.audit.record(actorId, 'GAME_ASSET_UPLOADED', 'GameAsset', asset.id, { byteSize: asset.byteSize, category: asset.category });
    return asset;
  }

  async saveConfig(actorId: string, id: string, input: SaveAssetConfigDto) {
    const asset = await this.prisma.gameAsset.findUnique({ where: { id }, select: { id: true, width: true, height: true } });
    if (!asset) throw new NotFoundException('Game asset not found');
    if (input.productId && !(await this.prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } }))) {
      throw new BadRequestException('Linked product does not exist');
    }
    const config: AssetConfigDto = {
      ...input.config, assetId: id, image: `/api/v1/game-assets/${id}/image`, width: asset.width, height: asset.height,
    };
    const updated = await this.prisma.gameAsset.update({
      where: { id },
      data: {
        config: config as unknown as Prisma.InputJsonValue,
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
      },
      select: assetSelect,
    });
    await this.audit.record(actorId, 'GAME_ASSET_CONFIG_UPDATED', 'GameAsset', id, {
      collisions: config.collisionMasks.length, stairs: config.stairsZones.length,
      occlusion: config.occlusionMasks.length, productId: updated.productId,
    });
    return updated;
  }

  async remove(actorId: string, id: string) {
    const asset = await this.prisma.gameAsset.findUnique({ where: { id }, select: { id: true, isBuiltIn: true } });
    if (!asset) throw new NotFoundException('Game asset not found');
    if (asset.isBuiltIn) throw new ConflictException('Built-in assets can be edited but not deleted');
    await this.prisma.gameAsset.delete({ where: { id } });
    await this.audit.record(actorId, 'GAME_ASSET_DELETED', 'GameAsset', id);
  }

  listLevels() {
    return this.prisma.gameLevel.findMany({ orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }], take: 50 });
  }

  activeLevel() {
    return this.prisma.gameLevel.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
  }

  async saveLevel(actorId: string, input: SaveGameLevelDto) {
    const assetIds = [...new Set(input.objects.map(({ assetId }) => assetId))];
    const found = await this.prisma.gameAsset.count({ where: { id: { in: assetIds } } });
    if (found !== assetIds.length) throw new BadRequestException('Level references an unknown game asset');
    const config = { version: 1, objects: input.objects } as unknown as Prisma.InputJsonValue;
    const level = await this.prisma.$transaction(async (tx) => {
      if (input.isActive) await tx.gameLevel.updateMany({ where: { isActive: true, slug: { not: input.slug } }, data: { isActive: false } });
      return tx.gameLevel.upsert({
        where: { slug: input.slug },
        update: { name: input.name, width: input.width, height: input.height, config, isActive: input.isActive, updatedById: actorId },
        create: { slug: input.slug, name: input.name, width: input.width, height: input.height, config, isActive: input.isActive, updatedById: actorId },
      });
    });
    await this.audit.record(actorId, 'GAME_LEVEL_SAVED', 'GameLevel', level.id, { objects: input.objects.length, active: input.isActive });
    return level;
  }

  private decodePng(value: string) {
    const encoded = value.slice('data:image/png;base64,'.length);
    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length < 24 || buffer.length > 750_000) throw new BadRequestException('PNG must be between 24 bytes and 750 KB');
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!buffer.subarray(0, 8).equals(signature) || buffer.toString('ascii', 12, 16) !== 'IHDR') {
      throw new BadRequestException('Invalid PNG signature');
    }
    const width = buffer.readUInt32BE(16); const height = buffer.readUInt32BE(20);
    if (!width || !height || width > 4096 || height > 4096 || width * height > 16_777_216) {
      throw new BadRequestException('PNG dimensions exceed the safe limit');
    }
    return { buffer, width, height };
  }
}
