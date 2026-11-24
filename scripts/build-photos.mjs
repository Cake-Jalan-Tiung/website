// Writes each photo in src/assets/photos at the widths the site shows it, as WebP, into
// src/assets/photos/sized/<id>-<width>.webp. A menu row's 120px photo then downloads about 12 KB
// instead of the 150 KB original; photos.ts offers every width in a srcset and the browser picks.
// Never enlarges: a photo narrower than a width is written at its own width, and the file is
// named for the width it really has. Writes everything every run and removes what has no source
// left, so a replaced photo or a new quality always shows. Needs ImageMagick 7 with WebP
// (`brew install imagemagick`). Run: pnpm photos
import {execFileSync} from 'node:child_process';
import {mkdirSync, readdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const dir = fileURLToPath(new URL('../src/assets/photos/', import.meta.url));
const out = `${dir}sized/`;
const WIDTHS = [400, 800];
const QUALITY = '76';

mkdirSync(out, {recursive: true});
const sources = readdirSync(dir).filter((file) => /\.(jpe?g|png|webp|avif)$/i.test(file));
const wanted = new Set();
for (const file of sources) {
  const id = file.slice(0, file.lastIndexOf('.')).toLowerCase();
  const own = Number(execFileSync('magick', ['identify', '-format', '%w', `${dir}${file}[0]`], {encoding: 'utf8'}));
  for (const width of new Set(WIDTHS.map((width) => Math.min(width, own)))) {
    const name = `${id}-${width}.webp`;
    wanted.add(name);
    execFileSync('magick', [dir + file, '-auto-orient', '-resize', `${width}x>`, '-strip', '-quality', QUALITY, out + name]);
  }
}
const removed = readdirSync(out).filter((name) => !wanted.has(name));
for (const name of removed) rmSync(out + name);
console.log(`${sources.length} photos: ${wanted.size} files written, ${removed.length} removed`);
