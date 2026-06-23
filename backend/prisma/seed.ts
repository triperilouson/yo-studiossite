import { PrismaClient, ProductStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

async function seedProducts(): Promise<void> {
  const products = [
    {
      slug: 'rain-tee', title: 'RAIN TEE', sku: 'YO-RAIN',
      description: 'Relaxed oversized silhouette with lace details.', category: 'tshirts', sizes: ['L', 'XL'], priceMinor: 25_000,
      images: [
        '/assets/tshirts/raain.jpg', '/assets/tshirts/rainf.png', '/assets/tshirts/rainn.png',
        '/assets/tshirts/rainl.jpg', '/assets/tshirts/rainwomen.jpg', '/assets/tshirts/rainmen.png',
        '/assets/tshirts/sizes34.jpg',
      ],
    },
    {
      slug: 'litchen-tee', title: 'LITCHEN TEE', sku: 'YO-LITCHEN',
      description: 'Relaxed oversized silhouette with lace details.', category: 'tshirts', sizes: ['L', 'XL'], priceMinor: 25_000,
      images: [
        '/assets/tshirts/licchen.png', '/assets/tshirts/lichenf.png', '/assets/tshirts/lichenl.png',
        '/assets/tshirts/lichenn.png', '/assets/tshirts/lichenwomen.png', '/assets/tshirts/lichenmen.png',
        '/assets/tshirts/sizes34.jpg',
      ],
    },
  ];
  for (const product of products) {
    const images = product.images.map((url, position) => ({
      url, position, alt: `${product.title} image ${position + 1}`,
    }));
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        title: product.title,
        description: product.description,
        category: product.category,
        status: ProductStatus.ACTIVE,
        images: { deleteMany: {}, create: images },
      },
      create: {
        slug: product.slug,
        title: product.title,
        description: product.description,
        category: product.category,
        season: 'S1 / BETWEEN WIND AND WATER',
        images: { create: images },
        status: ProductStatus.ACTIVE,
        variants: {
          create: product.sizes.map((size) => ({
            sku: `${product.sku}-${size}`, size, priceMinor: product.priceMinor,
            currency: 'ILS', stock: 10,
          })),
        },
      },
    });
  }
}

async function removeLegacyGameProducts(): Promise<void> {
  const legacyProducts = await prisma.product.findMany({
    where: {
      slug: { in: ['black-lace-tee', 'black-pants', 'dark-jacket'] },
      variants: { some: { sku: { startsWith: 'YO-GAME-' } } },
    },
    select: { id: true, variants: { select: { id: true } } },
  });
  for (const product of legacyProducts) {
    const variantIds = product.variants.map(({ id }) => id);
    const hasOrderHistory = await prisma.orderItem.count({ where: { variantId: { in: variantIds } } });
    if (hasOrderHistory) {
      await prisma.product.update({ where: { id: product.id }, data: { status: ProductStatus.ARCHIVED } });
      continue;
    }
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { variantId: { in: variantIds } } }),
      prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } }),
      prisma.product.delete({ where: { id: product.id } }),
    ]);
  }
}

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 18) throw new Error('SUPER_ADMIN_PASSWORD must contain at least 18 characters');
  await prisma.user.upsert({
    where: { email },
    update: { role: Role.SUPER_ADMIN, isActive: true },
    create: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      firstName: 'YO',
      lastName: 'Administrator',
      role: Role.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
      cart: { create: {} },
    },
  });
}

async function seedGameEditor(): Promise<void> {
  const sourceDir = resolve(process.cwd(), '..', 'frontend', 'showroom', 'assets');
  const assets = [
    { slug: 'builtin-player', name: 'YO PLAYER SPRITESHEET', category: 'characters', file: 'player.png', allowFlipY: false },
    { slug: 'builtin-furniture', name: 'YO FURNITURE ATLAS', category: 'furniture', file: 'furniture.png', allowFlipY: false },
    { slug: 'builtin-products', name: 'YO PRODUCT SPRITESHEET', category: 'clothing', file: 'products.png', allowFlipY: false },
    { slug: 'builtin-floor-tiles', name: 'YO FLOOR AND WALL TILES', category: 'floor', file: 'tiles.png', allowFlipY: true },
    { slug: 'builtin-cart-directions', name: 'YO CART 4 DIRECTIONS', category: 'machines', file: 'cart-directions.png', allowFlipY: false },
    { slug: 'builtin-black-lace-tee', name: 'BLACK LACE TEE SPRITE', category: 'clothing', file: 'black-lace-tee.png', allowFlipY: false },
    { slug: 'builtin-black-pants', name: 'BLACK PANTS SPRITE', category: 'clothing', file: 'black-pants.png', allowFlipY: false },
    { slug: 'builtin-dark-jacket', name: 'DARK JACKET SPRITE', category: 'clothing', file: 'dark-jacket.png', allowFlipY: false },
  ];
  for (const source of assets) {
    const imageData = readFileSync(resolve(sourceDir, source.file));
    const width = imageData.readUInt32BE(16);
    const height = imageData.readUInt32BE(20);
    const asset = await prisma.gameAsset.upsert({
      where: { slug: source.slug },
      update: { name: source.name, category: source.category, byteSize: imageData.length, width, height, imageData, isBuiltIn: true },
      create: {
        slug: source.slug, name: source.name, category: source.category, byteSize: imageData.length,
        width, height, imageData, isBuiltIn: true, config: {},
      },
      select: { id: true },
    });
    await prisma.gameAsset.update({
      where: { id: asset.id },
      data: {
        config: {
          assetId: asset.id, image: `/api/v1/game-assets/${asset.id}/image`, width, height,
          anchor: { x: Math.round(width / 2), y: height }, depthBaseline: [], collisionMasks: [],
          stairsZones: [], occlusionMasks: [], walkableMasks: [], allowFlipX: true, allowFlipY: source.allowFlipY,
        },
      },
    });
  }
  await prisma.gameLevel.upsert({
    where: { slug: 'yo-showroom' },
    update: {},
    create: { slug: 'yo-showroom', name: 'YO SHOWROOM', width: 1280, height: 768, config: { version: 1, objects: [] }, isActive: true },
  });
}

async function main(): Promise<void> {
  await removeLegacyGameProducts();
  await seedProducts();
  await seedSuperAdmin();
  await seedGameEditor();
}

void main().finally(async () => prisma.$disconnect());
