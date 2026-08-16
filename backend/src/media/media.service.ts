import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Environment } from '../config/env';
import type { UploadImageDto } from './dto/upload-image.dto';

const imageTypes = {
  'image/png': { extension: 'png', signatures: [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])] },
  'image/jpeg': { extension: 'jpg', signatures: [Buffer.from([255, 216, 255])] },
  'image/webp': { extension: 'webp', signatures: [Buffer.from('RIFF', 'ascii')] },
  'image/gif': { extension: 'gif', signatures: [Buffer.from('GIF87a', 'ascii'), Buffer.from('GIF89a', 'ascii')] },
} as const;

@Injectable()
export class MediaService {
  private r2Client?: S3Client;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  async uploadImage(input: UploadImageDto) {
    const r2 = this.r2Config();
    if (!r2) throw new ServiceUnavailableException('R2 image storage is not configured');

    const image = this.decodeImage(input.imageBase64);
    const name = this.slug(input.fileName || 'image') || 'image';
    const key = `${r2.objectPrefix}${input.scope}/${input.ownerSlug}/${Date.now()}-${randomUUID().slice(0, 8)}-${name}.${image.extension}`;

    await this.r2(r2).send(new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: image.buffer,
      ContentType: image.mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return {
      url: `${r2.publicUrl}/${key}`,
      key,
      mimeType: image.mimeType,
      byteSize: image.buffer.length,
    };
  }

  private decodeImage(value: string) {
    const match = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new BadRequestException('Unsupported image data');

    const rawMimeType = match[1];
    const encoded = match[2];
    if (!rawMimeType || !encoded) throw new BadRequestException('Unsupported image data');

    const mimeType = rawMimeType === 'image/jpg' ? 'image/jpeg' : rawMimeType;
    if (!this.isImageMimeType(mimeType)) throw new BadRequestException('Unsupported image type');

    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length < 24 || buffer.length > 8_000_000) {
      throw new BadRequestException('Image must be between 24 bytes and 8 MB');
    }

    const type = imageTypes[mimeType];
    const validSignature = type.signatures.some((signature) => buffer.subarray(0, signature.length).equals(signature));
    const validWebp = mimeType !== 'image/webp' || buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!validSignature || !validWebp) throw new BadRequestException('Invalid image signature');

    return { buffer, mimeType, extension: type.extension };
  }

  private isImageMimeType(value: string): value is keyof typeof imageTypes {
    return value in imageTypes;
  }

  private r2(r2: NonNullable<ReturnType<MediaService['r2Config']>>) {
    if (!this.r2Client) {
      this.r2Client = new S3Client({
        region: 'auto',
        endpoint: r2.endpoint,
        credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
        forcePathStyle: true,
      });
    }
    return this.r2Client;
  }

  private r2Config() {
    const accessKeyId = this.config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = this.config.get('R2_SECRET_ACCESS_KEY', { infer: true });
    const bucket = this.config.get('R2_BUCKET', { infer: true });
    const publicUrl = this.config.get('R2_PUBLIC_URL', { infer: true });
    const endpoint = this.config.get('R2_ENDPOINT', { infer: true });
    if (!accessKeyId || !secretAccessKey || !bucket || !publicUrl || !endpoint) return null;

    const rawPrefix = this.config.get('R2_OBJECT_PREFIX', { infer: true }) || '';
    const objectPrefix = rawPrefix ? `${rawPrefix.replace(/^\/+|\/+$/g, '')}/` : '';
    return { accessKeyId, secretAccessKey, bucket, publicUrl: publicUrl.replace(/\/+$/g, ''), endpoint, objectPrefix };
  }

  private slug(value: string) {
    return value.trim().toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}
