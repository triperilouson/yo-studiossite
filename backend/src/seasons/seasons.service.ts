import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, SeasonStatus } from '@prisma/client';
import { AdminAuditService } from '../common/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDto, UpdateSeasonDto } from './dto/season.dto';

const seasonSelect = {
  id: true, slug: true, code: true, title: true, description: true, campaignText: true,
  status: true, sortOrder: true, isFeatured: true, releaseAt: true,
  publishedAt: true, archivedAt: true, createdAt: true, updatedAt: true,
  images: {
    select: { id: true, url: true, alt: true, position: true },
    orderBy: { position: 'asc' as const },
  },
} as const;

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AdminAuditService) {}

  listPublic(includeArchived = false) {
    return this.prisma.season.findMany({
      where: { status: includeArchived ? { in: [SeasonStatus.PUBLISHED, SeasonStatus.ARCHIVED] } : SeasonStatus.PUBLISHED },
      select: seasonSelect, orderBy: [{ sortOrder: 'desc' }, { publishedAt: 'desc' }], take: 50,
    });
  }

  async getPublic(slug: string) {
    const season = await this.prisma.season.findFirst({
      where: { slug: slug.toLowerCase(), status: { in: [SeasonStatus.PUBLISHED, SeasonStatus.ARCHIVED] } },
      select: seasonSelect,
    });
    if (!season) throw new NotFoundException('Season not found');
    return season;
  }

  featured() {
    return this.prisma.season.findFirst({
      where: { isFeatured: true, status: SeasonStatus.PUBLISHED }, select: seasonSelect,
    });
  }

  async preview(slug: string, rawToken: string | undefined) {
    if (!rawToken || rawToken.length < 32) throw new UnauthorizedException('Invalid preview link');
    const record = await this.prisma.season.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { ...seasonSelect, previewTokenHash: true },
    });
    if (!record?.previewTokenHash) throw new UnauthorizedException('Invalid preview link');
    const { previewTokenHash, ...season } = record;
    const actual = Buffer.from(this.hashToken(rawToken), 'hex');
    const expected = Buffer.from(previewTokenHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Invalid preview link');
    }
    return season;
  }

  listAdmin() {
    return this.prisma.season.findMany({
      select: seasonSelect, orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }], take: 100,
    });
  }

  async create(actorId: string, input: CreateSeasonDto) {
    this.assertPositions(input.images);
    try {
      const now = new Date();
      const season = await this.prisma.$transaction(async (tx) => {
        if (input.isFeatured) await tx.season.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } });
        return tx.season.create({
          data: {
            slug: input.slug.toLowerCase(), code: input.code.toUpperCase(), title: input.title.trim(),
            description: input.description.trim(), campaignText: input.campaignText?.trim(),
            status: input.status ?? SeasonStatus.DRAFT, sortOrder: input.sortOrder ?? 0,
            isFeatured: input.isFeatured ?? false,
            releaseAt: input.releaseAt ? new Date(input.releaseAt) : undefined,
            ...(input.status === SeasonStatus.PUBLISHED ? { publishedAt: now } : {}),
            ...(input.status === SeasonStatus.ARCHIVED ? { archivedAt: now } : {}),
            images: { create: input.images },
          },
          select: seasonSelect,
        });
      });
      await this.audit.record(actorId, 'SEASON_CREATED', 'Season', season.id, { status: season.status });
      return season;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Season slug or code already exists');
      }
      throw error;
    }
  }

  async update(actorId: string, id: string, input: UpdateSeasonDto) {
    if (!(await this.prisma.season.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Season not found');
    }
    if (input.images) this.assertPositions(input.images);
    const { images, releaseAt, ...values } = input;
    const now = new Date();
    try {
      const season = await this.prisma.$transaction(async (tx) => {
        if (input.isFeatured) {
          await tx.season.updateMany({ where: { isFeatured: true, id: { not: id } }, data: { isFeatured: false } });
        }
        return tx.season.update({
          where: { id },
          data: {
            ...values,
            ...(values.slug ? { slug: values.slug.toLowerCase() } : {}),
            ...(values.code ? { code: values.code.toUpperCase() } : {}),
            ...(values.campaignText ? { campaignText: values.campaignText.trim() } : {}),
            ...(releaseAt !== undefined ? { releaseAt: releaseAt ? new Date(releaseAt) : null } : {}),
            ...(values.status === SeasonStatus.PUBLISHED ? { publishedAt: now, archivedAt: null } : {}),
            ...(values.status === SeasonStatus.ARCHIVED ? { archivedAt: now, isFeatured: false } : {}),
            ...(images ? { images: { deleteMany: {}, create: images } } : {}),
          },
          select: seasonSelect,
        });
      });
      await this.audit.record(actorId, 'SEASON_UPDATED', 'Season', id, { status: season.status });
      return season;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Season slug or code already exists');
      }
      throw error;
    }
  }

  async rotatePreviewToken(actorId: string, id: string) {
    const season = await this.prisma.season.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!season) throw new NotFoundException('Season not found');
    const token = randomBytes(32).toString('base64url');
    await this.prisma.season.update({ where: { id }, data: { previewTokenHash: this.hashToken(token) } });
    await this.audit.record(actorId, 'SEASON_PREVIEW_TOKEN_ROTATED', 'Season', id);
    return { path: `season.html?slug=${encodeURIComponent(season.slug)}&preview=${encodeURIComponent(token)}` };
  }

  private assertPositions(images: Array<{ position: number }>) {
    if (new Set(images.map(({ position }) => position)).size !== images.length) {
      throw new ConflictException('Season image positions must be unique');
    }
  }

  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
}
