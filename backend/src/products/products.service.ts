import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateInventoryDto, UpdateProductDto } from './dto/admin-product.dto';
import { AdminAuditService } from '../common/admin-audit.service';

const productSelect = {
  id: true, slug: true, title: true, description: true, category: true, season: true,
  images: {
    select: { id: true, url: true, alt: true, position: true },
    orderBy: { position: 'asc' as const },
  },
  status: true, createdAt: true, updatedAt: true,
  variants: {
    select: {
      id: true, sku: true, size: true, priceMinor: true, currency: true,
      stock: true, reservedStock: true, isActive: true,
    },
    orderBy: { size: 'asc' as const },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(category?: string) {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, ...(category ? { category: category.toLowerCase().slice(0, 80) } : {}) },
      select: productSelect, orderBy: { createdAt: 'desc' }, take: 100,
    });
    return products.map(this.publicProduct);
  }

  async getBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug: slug.toLowerCase(), status: ProductStatus.ACTIVE }, select: productSelect,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.publicProduct(product);
  }

  listForAdmin() {
    return this.prisma.product.findMany({ select: productSelect, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async create(actorId: string, input: CreateProductDto) {
    const duplicateSizes = new Set(input.variants.map((variant) => variant.size.toUpperCase()));
    if (duplicateSizes.size !== input.variants.length) throw new ConflictException('Variant sizes must be unique');
    this.assertUniqueImagePositions(input.images);
    try {
      const product = await this.prisma.product.create({
        data: {
          title: input.title.trim(), slug: input.slug, category: input.category.trim().toLowerCase(),
          season: input.season?.trim(), description: input.description.trim(),
          images: { create: input.images },
          status: input.status ?? ProductStatus.DRAFT,
          variants: { create: input.variants.map((v) => ({ ...v, sku: v.sku.toUpperCase(), size: v.size.toUpperCase() })) },
        },
        select: productSelect,
      });
      await this.audit.record(actorId, 'PRODUCT_CREATED', 'Product', product.id, { status: product.status });
      return product;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Product slug, SKU or size already exists');
      }
      throw error;
    }
  }

  async update(actorId: string, id: string, input: UpdateProductDto) {
    await this.requireProduct(id);
    if (input.images) this.assertUniqueImagePositions(input.images);
    const { images, ...productData } = input;
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(images ? { images: { deleteMany: {}, create: images } } : {}),
      },
      select: productSelect,
    });
    await this.audit.record(actorId, 'PRODUCT_UPDATED', 'Product', id, {
      status: product.status,
    });
    return product;
  }

  async updateInventory(actorId: string, variantId: string, input: UpdateInventoryDto) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found');
    if (input.stock < variant.reservedStock) {
      throw new ConflictException('Stock cannot be lower than currently reserved stock');
    }
    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        stock: input.stock,
        ...(input.priceMinor !== undefined ? { priceMinor: input.priceMinor } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await this.audit.record(actorId, 'INVENTORY_UPDATED', 'ProductVariant', variantId, {
      stock: updated.stock, priceMinor: updated.priceMinor, isActive: updated.isActive,
    });
    return updated;
  }

  private async requireProduct(id: string): Promise<void> {
    if (!(await this.prisma.product.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Product not found');
    }
  }

  private assertUniqueImagePositions(images: Array<{ position: number }>): void {
    if (new Set(images.map(({ position }) => position)).size !== images.length) {
      throw new ConflictException('Image positions must be unique');
    }
  }

  private readonly publicProduct = <T extends { variants: Array<{ stock: number; reservedStock: number; isActive: boolean }> }>(product: T) => ({
    ...product,
    variants: product.variants
      .filter(({ isActive }) => isActive)
      .map(({ stock, reservedStock, ...variant }) => ({
        ...variant, available: Math.max(0, stock - reservedStock),
      })),
  });
}
