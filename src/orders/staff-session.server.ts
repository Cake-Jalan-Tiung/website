// The staff screen's session: a cookie holding its expiry and an HMAC of it and the current PIN,
// keyed by SESSION_SECRET. Changing the PIN signs every device out.
import {toBase64Url} from '../lib/base64';

const encoder = new TextEncoder();
export const STAFF_COOKIE = 'cjt_staff';
export const STAFF_SESSION_DAYS = 30;

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

/** Compares two secrets in constant time: both are hashed to equal length, then every byte is compared. */
export async function sameSecret(a: string, b: string) {
  const [left, right] = await Promise.all([a, b].map(async (text) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))));
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

const signed = (secret: string, pin: string, expires: string) => hmac(secret, `staff.${expires}.${pin}`);

export async function issueStaffToken(secret: string, pin: string, now: Date) {
  const expires = String(now.getTime() + STAFF_SESSION_DAYS * 86_400_000);
  return `${expires}.${toBase64Url(await signed(secret, pin, expires))}`;
}

export async function isStaffToken(secret: string, pin: string, token: string | undefined, now: Date) {
  if (!secret || !pin || !token) return false;
  const [expires, mac] = token.split('.');
  if (!expires || !mac || Number(expires) < now.getTime()) return false;
  return sameSecret(mac, toBase64Url(await signed(secret, pin, expires)));
}
