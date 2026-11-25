import {describe, expect, it} from 'vitest';
import {storefront} from '../site/content';
import {manifestIcons, webManifest} from './manifest';

const pngs = import.meta.glob<string>('../../public/*.png', {eager: true, query: '?inline', import: 'default'});

/** Width and height from the IHDR chunk of a PNG in public/. */
const pngSize = (src: string) => {
  const bytes = Uint8Array.from(atob(pngs[`../../public${src}`].split(',')[1]), (char) => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return `${view.getUint32(16)}x${view.getUint32(20)}`;
};

describe('webManifest', () => {
  it('installs the shop under its own name, opening on the menu', () => {
    const manifest = webManifest(storefront);
    expect(manifest.name).toBe('Cake Jalan Tiung');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/menu');
    expect(manifest.display).toBe('standalone');
  });

  it('names icons that exist at the size it gives', () => {
    for (const icon of manifestIcons) expect(pngSize(icon.src), icon.src).toBe(icon.sizes);
  });

  it('offers a maskable icon and a 512px one, which Android needs to install', () => {
    expect(manifestIcons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    expect(manifestIcons.some((icon) => icon.purpose === 'any' && icon.sizes === '512x512')).toBe(true);
  });
});
