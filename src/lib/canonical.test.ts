import {describe, expect, it} from 'vitest';
import {canonicalRedirect} from './canonical';

const SITE = 'https://cakejalantiung.app';
const ask = (url: string, method = 'GET') => canonicalRedirect(new Request(url, {method}), SITE);

describe('canonicalRedirect', () => {
  it('moves pages on www. to the site, keeping the path and query', () => {
    const response = ask('https://www.cakejalantiung.app/menu?from=ig#pastries');
    expect(response?.status).toBe(301);
    expect(response?.headers.get('location')).toBe('https://cakejalantiung.app/menu?from=ig');
  });

  it('moves pages on workers.dev to the site for now', () => {
    const response = ask('https://cakejalantiung.hazli-johar.workers.dev/order/abc', 'HEAD');
    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe('https://cakejalantiung.app/order/abc');
  });

  it('answers the site itself and local work in place', () => {
    expect(ask('https://cakejalantiung.app/menu')).toBeNull();
    expect(ask('http://localhost:5179/menu')).toBeNull();
  });

  it('answers calls made by code where they arrive', () => {
    expect(ask('https://cakejalantiung.hazli-johar.workers.dev/api/payments/callback', 'POST')).toBeNull();
    expect(ask('https://www.cakejalantiung.app/api/delivery/callback')).toBeNull();
    expect(ask('https://cakejalantiung.hazli-johar.workers.dev/_serverFn/abc123')).toBeNull();
  });
});
