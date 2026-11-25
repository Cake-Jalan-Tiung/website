import {describe, expect, it} from 'vitest';
import {installWay} from './install';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1';
const IPHONE_INSTAGRAM = `${IPHONE_SAFARI.replace(' Safari/604.1', '')} Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; en_MY)`;
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const device = (userAgent: string, rest: Partial<{standalone: boolean; prompt: boolean; touchPoints: number}> = {}) =>
  installWay({standalone: false, prompt: false, touchPoints: 5, userAgent, ...rest});

describe('installWay', () => {
  it('offers nothing once the shop runs as an installed app', () => {
    expect(device(ANDROID_CHROME, {standalone: true, prompt: true})).toBe('installed');
    expect(device(IPHONE_SAFARI, {standalone: true})).toBe('installed');
  });

  it('uses the browser’s own prompt when it offers one', () => {
    expect(device(ANDROID_CHROME, {prompt: true})).toBe('prompt');
  });

  it('gives the Share steps on an iPhone or iPad, in Safari or Chrome', () => {
    expect(device(IPHONE_SAFARI)).toBe('ios');
    expect(device(IPHONE_CHROME)).toBe('ios');
    expect(device(IPAD_AS_MAC)).toBe('ios');
  });

  it('offers nothing it cannot keep: a Mac, an in-app browser, Android before any prompt', () => {
    expect(device(IPAD_AS_MAC, {touchPoints: 0})).toBe('none');
    expect(device(IPHONE_INSTAGRAM)).toBe('none');
    expect(device(ANDROID_CHROME)).toBe('none');
  });
});
