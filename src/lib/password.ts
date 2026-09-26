import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, hex] = encoded.split(':');
  if (!salt || !hex || hex.length !== 128) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
