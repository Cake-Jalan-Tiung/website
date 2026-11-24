// A delivery fee the server quoted, handed to the browser and back, so the fee on Pay is the fee
// charged without asking the courier again while the customer pays: its price can move between
// two calls. Signed with the session secret; it holds the point it was quoted for and lasts an hour.
import {fromBase64, toBase64Url} from '../lib/base64';
import {isRecord} from '../lib/guards';
import type {Place} from './model';

const LIFETIME_MS = 60 * 60_000;

export type Quoted = {feeSen: number; distanceM: number};

const encoder = new TextEncoder();
const key = (secret: string) => crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
const fromBase64Url = (text: string) => fromBase64(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));

export async function signQuote(secret: string, place: Place, quoted: Quoted, now: Date): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({lat: place.lat, lng: place.lng, fee: quoted.feeSen, m: quoted.distanceM, exp: now.getTime() + LIFETIME_MS})));
  const signature = toBase64Url(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)));
  return `${payload}.${signature}`;
}

/** The fee and distance in `token`, when it is this server's, unexpired and for this very point; null otherwise. */
export async function readQuote(secret: string, token: string, place: Place, now: Date): Promise<Quoted | null> {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await key(secret), fromBase64Url(signature), encoder.encode(payload)))) return null;
    const body: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (!isRecord(body)) return null;
    const {lat, lng, fee, m, exp} = body;
    if (typeof fee !== 'number' || typeof m !== 'number' || typeof exp !== 'number' || exp < now.getTime()) return null;
    if (lat !== place.lat || lng !== place.lng) return null;
    return {feeSen: fee, distanceM: m};
  } catch {
    return null;
  }
}
