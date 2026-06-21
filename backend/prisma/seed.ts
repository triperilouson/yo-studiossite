import { PrismaClient, ProductStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedProducts(): Promise<void> {
  const products = [
    {
      slug: 'rain-tee', title: 'RAIN TEE', sku: 'YO-RAIN',
      images: [
        '/assets/tshirts/raain.jpg', '/assets/tshirts/rainf.png', '/assets/tshirts/rainn.png',
        '/assets/tshirts/rainl.jpg', '/assets/tshirts/rainwomen.jpg', '/assets/tshirts/rainmen.png',
        '/assets/tshirts/sizes34.jpg',
      ],
    },
    {
      slug: 'litchen-tee', title: 'LITCHEN TEE', sku: 'YO-LITCHEN',
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
        status: ProductStatus.ACTIVE,
        images: { deleteMany: {}, create: images },
      },
      create: {
        slug: product.slug,
        title: product.title,
        description: 'Relaxed oversized silhouette with lace details.',
        category: 'tshirts',
        season: 'S1 / BETWEEN WIND AND WATER',
        images: { create: images },
        status: ProductStatus.ACTIVE,
        variants: {
          create: ['L', 'XL'].map((size) => ({
            sku: `${product.sku}-${size}`, size, priceMinor: 25_000,
            currency: 'ILS', stock: 10,
          })),
        },
      },
    });
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

async function main(): Promise<void> {
  await seedProducts();
  await seedSuperAdmin();
}

void main().finally(async () => prisma.$disconnect());
