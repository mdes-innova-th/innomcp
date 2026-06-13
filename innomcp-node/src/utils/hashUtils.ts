import { createHash, randomBytes, randomUUID } from 'node:crypto';

export function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function randomHex(n: number): string {
  return randomBytes(n).toString('hex');
}

export function uuid(): string {
  return randomUUID();
}
