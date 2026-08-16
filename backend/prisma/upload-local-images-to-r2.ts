import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...parts] = trimmed.split('=');
    process.env[key] ??= parts.join('=');
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function contentType(path: string) {
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

function safeFileName(path: string) {
  const extension = extname(path).toLowerCase() || '.png';
  const name = basename(path, extname(path)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
  return `${name}${extension}`;
}

function assetPath(url: string) {
  const relative = url.replace(/^\/+/, '');
  if (!relative.startsWith('assets/')) return null;
  return resolve(process.cwd(), '..', 'frontend', relative);
}

async function upload(client: S3Client, bucket: string, publicUrl: string, key: string, path: string) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: readFileSync(path),
    ContentType: contentType(path),
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${publicUrl}/${key}`;
}

async function main() {
  loadLocalEnv();
  const bucket = required('R2_BUCKET');
  const publicUrl = required('R2_PUBLIC_URL').replace(/\/+$/g, '');
  const rawPrefix = process.env.R2_OBJECT_PREFIX?.trim() || '';
  const prefix = rawPrefix ? `${rawPrefix.replace(/^\/+|\/+$/g, '')}/` : '';
  const client = new S3Client({
    region: 'auto',
    endpoint: required('R2_ENDPOINT'),
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });

  const productImages = await prisma.productImage.findMany({
    where: { url: { startsWith: '/assets/' } },
    select: { id: true, url: true, product: { select: { slug: true } } },
  });
  for (const image of productImages) {
    const path = assetPath(image.url);
    if (!path || !existsSync(path)) {
      console.warn(`Missing local product image: ${image.url}`);
      continue;
    }
    const key = `${prefix}products/${image.product.slug}/${safeFileName(path)}`;
    const url = await upload(client, bucket, publicUrl, key, path);
    await prisma.productImage.update({ where: { id: image.id }, data: { url } });
    console.log(`${image.url} -> ${url}`);
  }

  const seasonImages = await prisma.seasonImage.findMany({
    where: { url: { startsWith: '/assets/' } },
    select: { id: true, url: true, season: { select: { slug: true } } },
  });
  for (const image of seasonImages) {
    const path = assetPath(image.url);
    if (!path || !existsSync(path)) {
      console.warn(`Missing local season image: ${image.url}`);
      continue;
    }
    const key = `${prefix}seasons/${image.season.slug}/${safeFileName(path)}`;
    const url = await upload(client, bucket, publicUrl, key, path);
    await prisma.seasonImage.update({ where: { id: image.id }, data: { url } });
    console.log(`${image.url} -> ${url}`);
  }
}

void main().finally(async () => prisma.$disconnect());
