import { PrismaClient, ProductStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

const legacyFurnitureFrames = {
  counter: [0, 0, 256, 128],
  pile: [256, 0, 192, 128],
  vending: [0, 128, 96, 128],
  crt: [96, 128, 64, 96],
  rack: [160, 128, 224, 128],
  table: [0, 256, 192, 112],
  door: [272, 256, 80, 128],
  ac: [352, 256, 128, 64],
  logo: [0, 368, 128, 80],
  seller: [128, 368, 64, 96],
  sewing: [192, 368, 112, 80],
  boxes: [304, 368, 128, 96],
} as const;

function levelObject(
  id: string,
  assetId: string,
  x: number,
  y: number,
  layer: string,
  depthOffset = 0,
  extra: Record<string, unknown> = {},
) {
  return {
    id, assetId, x, y, z: 0, rotation: 0, scaleX: 1, scaleY: 1,
    flipX: false, flipY: false, layer, depthOffset, locked: false, ...extra,
  };
}

function legacySourceRect(name: keyof typeof legacyFurnitureFrames) {
  const [x, y, width, height] = legacyFurnitureFrames[name];
  return { x, y, width, height };
}

function defaultShowroomConfig(assetBySlug: Map<string, string>) {
  const furniture = assetBySlug.get('builtin-furniture');
  const tee = assetBySlug.get('builtin-black-lace-tee');
  const pants = assetBySlug.get('builtin-black-pants');
  const jacket = assetBySlug.get('builtin-dark-jacket');
  if (!furniture || !tee || !pants || !jacket) return null;

  return {
    version: 1,
    room: { left: 64, top: 154, right: 1216, bottom: 718 },
    playerSpawn: { x: 620, y: 650 },
    cartSpawn: { x: 342, y: 634 },
    interactions: [
      { id: 'vending', x: 205, y: 338, radius: 68, label: 'USE COFFEE VENDING' },
      { id: 'crt', x: 330, y: 350, radius: 64, label: 'WATCH DROP SIGNAL' },
      { id: 'staff', x: 148, y: 192, radius: 60, label: 'STAFF ONLY' },
      { id: 'pile', x: 1080, y: 375, radius: 75, label: 'INSPECT FABRIC ARCHIVE' },
      { id: 'checkout', x: 804, y: 337, radius: 88, label: 'CHECK OUT' },
    ],
    lights: [
      { x: 148, y: 183, radius: 180, color: [224, 185, 119], strength: 0.18, speed: 0.0017 },
      { x: 590, y: 151, radius: 230, color: [225, 190, 128], strength: 0.15, speed: 0.0013 },
      { x: 804, y: 205, radius: 170, color: [221, 181, 113], strength: 0.18, speed: 0.0019 },
      { x: 1080, y: 212, radius: 185, color: [232, 199, 139], strength: 0.16, speed: 0.0015 },
      { x: 198, y: 258, radius: 115, color: [104, 143, 139], strength: 0.11, speed: 0.0022 },
    ],
    objects: [
      levelObject('legacy-door', furniture, 148, 183, 'walls', 0, { sourceRect: legacySourceRect('door'), collision: { x: 108, y: 158, width: 80, height: 25 } }),
      levelObject('legacy-logo', furniture, 584, 141, 'decor', 0, { sourceRect: legacySourceRect('logo') }),
      levelObject('legacy-ac', furniture, 1042, 130, 'machines', 0, { sourceRect: legacySourceRect('ac') }),
      levelObject('legacy-vending', furniture, 203, 323, 'machines', 0, { sourceRect: legacySourceRect('vending'), collision: { x: 163, y: 298, width: 78, height: 35 } }),
      levelObject('legacy-crt', furniture, 330, 331, 'machines', 0, { sourceRect: legacySourceRect('crt'), collision: { x: 303, y: 306, width: 55, height: 30 } }),
      levelObject('legacy-counter', furniture, 810, 306, 'checkout', -2, { sourceRect: legacySourceRect('counter'), collision: { x: 699, y: 252, width: 222, height: 61 } }),
      levelObject('legacy-seller', furniture, 810, 257, 'characters', 1, { sourceRect: legacySourceRect('seller') }),
      levelObject('legacy-pile', furniture, 1090, 350, 'decor', -5, { sourceRect: legacySourceRect('pile'), collision: { x: 1010, y: 308, width: 166, height: 48 } }),
      levelObject('legacy-sewing', furniture, 1091, 284, 'sewing', 1, { sourceRect: legacySourceRect('sewing') }),
      levelObject('legacy-rack-left', furniture, 198, 476, 'furniture', 0, { sourceRect: legacySourceRect('rack'), collision: { x: 102, y: 435, width: 195, height: 43 } }),
      levelObject('legacy-table', furniture, 534, 477, 'furniture', 0, { sourceRect: legacySourceRect('table'), collision: { x: 463, y: 435, width: 157, height: 53 } }),
      levelObject('legacy-rack-right', furniture, 936, 621, 'furniture', 0, { sourceRect: legacySourceRect('rack'), collision: { x: 840, y: 580, width: 195, height: 43 } }),
      levelObject('legacy-boxes', furniture, 1116, 589, 'decor', 1, { sourceRect: legacySourceRect('boxes'), collision: { x: 1059, y: 552, width: 112, height: 50 } }),
      levelObject('legacy-product-tee', tee, 263, 474, 'clothing', 0),
      levelObject('legacy-product-pants', pants, 542, 462, 'clothing', 0),
      levelObject('legacy-product-jacket', jacket, 946, 612, 'clothing', 0),
    ],
  };
}

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

async function seedShipping(): Promise<void> {
  await prisma.pickupLocation.upsert({
    where: { slug: 'yo-studios-pickup' },
    update: {
      name: 'YO STUDIOS PICKUP',
      country: 'IL',
      city: 'Tel Aviv',
      address: 'Pickup address to be confirmed',
      details: 'Update this pickup location in the admin shipping panel before production orders.',
      isActive: true,
      sortOrder: 10,
    },
    create: {
      slug: 'yo-studios-pickup',
      name: 'YO STUDIOS PICKUP',
      country: 'IL',
      city: 'Tel Aviv',
      address: 'Pickup address to be confirmed',
      details: 'Update this pickup location in the admin shipping panel before production orders.',
      isActive: true,
      sortOrder: 10,
    },
  });
}

async function seedGameEditor(): Promise<void> {
  const sourceDir = resolve(process.cwd(), '..', 'frontend', 'showroom', 'assets');
  if (!existsSync(sourceDir)) {
    console.warn(`Skipping game editor seed: asset directory not found at ${sourceDir}`);
    return;
  }
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
  const assetBySlug = new Map<string, string>();
  for (const source of assets) {
    const sourcePath = resolve(sourceDir, source.file);
    if (!existsSync(sourcePath)) {
      console.warn(`Skipping game editor asset ${source.slug}: file not found at ${sourcePath}`);
      continue;
    }
    const imageData = readFileSync(sourcePath);
    const width = imageData.readUInt32BE(16);
    const height = imageData.readUInt32BE(20);
    const asset = await prisma.gameAsset.upsert({
      where: { slug: source.slug },
      update: { name: source.name, category: source.category, byteSize: imageData.length, width, height, imageData, isBuiltIn: true },
      create: {
        slug: source.slug, name: source.name, category: source.category, byteSize: imageData.length,
        width, height, imageData, isBuiltIn: true, config: {},
      },
      select: { id: true, slug: true },
    });
    assetBySlug.set(asset.slug, asset.id);
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
  const defaultConfig = defaultShowroomConfig(assetBySlug);
  if (!defaultConfig) {
    console.warn('Skipping default showroom level seed: built-in game assets are incomplete');
    return;
  }
  const existingLevel = await prisma.gameLevel.findUnique({ where: { slug: 'yo-showroom' } });
  if (!existingLevel) {
    await prisma.gameLevel.create({
      data: { slug: 'yo-showroom', name: 'YO SHOWROOM', width: 1280, height: 768, config: defaultConfig, isActive: true },
    });
    return;
  }

  const existingConfig = existingLevel.config && typeof existingLevel.config === 'object' && !Array.isArray(existingLevel.config)
    ? existingLevel.config as Record<string, unknown>
    : {};
  const existingObjects = Array.isArray(existingConfig.objects) ? existingConfig.objects as Array<{ id?: string }> : [];
  const objectIds = new Set(existingObjects.map(({ id }) => id).filter(Boolean));
  const missingObjects = defaultConfig.objects.filter((object) => !objectIds.has(object.id));
  await prisma.gameLevel.update({
    where: { slug: 'yo-showroom' },
    data: {
      width: existingLevel.width || 1280,
      height: existingLevel.height || 768,
      isActive: existingLevel.isActive,
      config: {
        ...defaultConfig,
        ...existingConfig,
        version: 1,
        objects: [...existingObjects, ...missingObjects],
      },
    },
  });
}

async function main(): Promise<void> {
  await removeLegacyGameProducts();
  await seedProducts();
  await seedSuperAdmin();
  await seedShipping();
  await seedGameEditor();
}

void main().finally(async () => prisma.$disconnect());
