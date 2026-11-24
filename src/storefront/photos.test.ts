import {describe, expect, it} from 'vitest';
import {photoFor} from './photos';

const name = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const ids = Object.keys(import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp,avif}')).map((path) => name(path).slice(0, name(path).lastIndexOf('.')).toLowerCase());
const sizedIds = new Set(Object.keys(import.meta.glob('../assets/photos/sized/*.webp')).map((path) => name(path).replace(/-\d+\.webp$/, '')));

describe('photos', () => {
  it('has every photo sized; run pnpm photos after adding one', () => {
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !sizedIds.has(id))).toEqual([]);
    expect([...sizedIds].filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('offers each width, smallest first, with the largest as the fallback', () => {
    const photo = photoFor('missing-id', 'shio-pan');
    expect(photo?.srcSet?.split(', ').map((entry) => entry.split(' ')[1])).toEqual(['400w', '800w']);
    expect(photo?.src).toMatch(/shio-pan-800/);
  });
});
