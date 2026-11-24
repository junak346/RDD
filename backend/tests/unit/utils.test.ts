import { describe, expect, it } from 'vitest';

import {
  extensionForMime,
  generateStorageName,
  sanitizeDisplayName,
  sniffImageMime,
} from '../../src/utils/filenames';
import { hashPassword, isStrongPassword, verifyPassword } from '../../src/utils/passwords';
import { signToken, verifyToken } from '../../src/utils/tokens';

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('filename safety', () => {
  it('sniffs real image content types from magic bytes', () => {
    expect(sniffImageMime(JPEG_HEADER)).toBe('image/jpeg');
    expect(sniffImageMime(PNG_HEADER)).toBe('image/png');
    expect(sniffImageMime(Buffer.from('RIFF0000WEBP'))).toBe('image/webp');
    expect(sniffImageMime(Buffer.from('<?php echo hi ?>'))).toBeNull();
    expect(sniffImageMime(Buffer.from('GIF89a'))).toBeNull(); // not supported
  });

  it('generates storage names with the sniffed extension only', () => {
    const name = generateStorageName('image/jpeg');
    expect(name).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(() => generateStorageName('image/svg+xml')).toThrow();
  });

  it('neutralises hostile display names (never used in paths)', () => {
    expect(sanitizeDisplayName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeDisplayName('photo(1).jpg')).toBe('photo_1_.jpg');
  });

  it('maps only supported mime types to extensions', () => {
    expect(extensionForMime('image/png')).toBe('.png');
    expect(extensionForMime('application/x-sh')).toBeNull();
  });
});

describe('password hashing', () => {
  it('hashes and verifies with bcrypt (never plain text)', async () => {
    const hash = await hashPassword('s3cret-pass');
    expect(hash).not.toContain('s3cret-pass');
    expect(await verifyPassword('s3cret-pass', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('enforces the password policy', () => {
    expect(isStrongPassword('abcdef1')).toBe(false); // too short
    expect(isStrongPassword('abcdefgh')).toBe(false); // no digit
    expect(isStrongPassword('12345678')).toBe(false); // no letter
    expect(isStrongPassword('roadfix123')).toBe(true);
  });
});

describe('JWT tokens', () => {
  const payload = { sub: 'user-1', email: 'a@b.com', role: 'user' };

  it('round-trips a signed token', () => {
    const token = signToken(payload);
    expect(verifyToken(token)).toMatchObject(payload);
  });

  it('rejects tampered tokens', () => {
    const token = signToken(payload);
    expect(() => verifyToken(token.slice(0, -2) + 'xx')).toThrowError(/invalid or has expired/i);
    expect(() => verifyToken('not-a-jwt')).toThrowError();
  });
});
