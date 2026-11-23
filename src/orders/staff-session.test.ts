import {describe, expect, it} from 'vitest';
import {STAFF_SESSION_DAYS, isStaffToken, issueStaffToken} from './staff-session.server';

const now = new Date('2026-11-23T10:00:00Z');
const later = (days: number) => new Date(now.getTime() + days * 86_400_000);

describe('staff session', () => {
  it('accepts its own token until it expires', async () => {
    const token = await issueStaffToken('secret', '482913', now);
    expect(await isStaffToken('secret', '482913', token, later(1))).toBe(true);
    expect(await isStaffToken('secret', '482913', token, later(STAFF_SESSION_DAYS + 1))).toBe(false);
  });

  it('signs every device out when the PIN changes', async () => {
    const token = await issueStaffToken('secret', '482913', now);
    expect(await isStaffToken('secret', '771205', token, later(1))).toBe(false);
  });

  it('refuses a token from another secret, an edited expiry, or none at all', async () => {
    const token = await issueStaffToken('secret', '482913', now);
    const [, mac] = token.split('.');
    expect(await isStaffToken('other', '482913', token, later(1))).toBe(false);
    expect(await isStaffToken('secret', '482913', `${later(365).getTime()}.${mac}`, later(1))).toBe(false);
    expect(await isStaffToken('secret', '482913', undefined, later(1))).toBe(false);
    expect(await isStaffToken('secret', '', token, later(1))).toBe(false);
  });
});
