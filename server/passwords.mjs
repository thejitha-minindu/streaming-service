import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const format = /^scrypt\$32768\$8\$3\$([0-9a-f]{32})\$([0-9a-f]{128})$/;
const dummy = `scrypt$32768$8$3$${'0'.repeat(32)}$${'0'.repeat(128)}`;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, Buffer.from(salt, 'hex'), 64, options);
  return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const match = typeof encoded === 'string' ? encoded.match(format) : null;
  const [, salt, expected] = match || dummy.match(format);
  // Unknown accounts and accounts awaiting password setup use the same work factor.
  const key = await derive(password, Buffer.from(salt, 'hex'), 64, options);
  return timingSafeEqual(key, Buffer.from(expected, 'hex')) && Boolean(match);
}

export const hashSessionToken = token => createHash('sha256').update(token).digest('hex');
