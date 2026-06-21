import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class AdminMfaService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Environment, true>) {
    this.key = Buffer.from(String(config.get('MFA_ENCRYPTION_KEY', { infer: true })), 'base64');
    if (this.key.length !== 32) throw new ServiceUnavailableException('Invalid MFA encryption key');
  }

  generate(email: string) {
    const secret = this.base32Encode(randomBytes(20));
    return {
      secret,
      uri: `otpauth://totp/${encodeURIComponent(`YO STUDIOS:${email}`)}?secret=${secret}&issuer=${encodeURIComponent('YO STUDIOS')}&algorithm=SHA1&digits=6&period=30`,
    };
  }

  encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  decrypt(value: string): string {
    const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted MFA secret');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  verify(secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const counter = Math.floor(Date.now() / 30_000);
    return [-1, 0, 1].some((offset) => {
      const expected = this.code(secret, counter + offset);
      return timingSafeEqual(Buffer.from(expected), Buffer.from(code));
    });
  }

  private code(secret: string, counter: number): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', this.base32Decode(secret)).update(message).digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return value.toString().padStart(6, '0');
  }

  private base32Encode(value: Buffer): string {
    let bits = '';
    for (const byte of value) bits += byte.toString(2).padStart(8, '0');
    let output = '';
    for (let index = 0; index < bits.length; index += 5) {
      output += ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
    }
    return output;
  }

  private base32Decode(value: string): Buffer {
    let bits = '';
    for (const character of value.replace(/=+$/g, '').toUpperCase()) {
      const index = ALPHABET.indexOf(character);
      if (index < 0) throw new Error('Invalid base32 secret');
      bits += index.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
      bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    }
    return Buffer.from(bytes);
  }
}
