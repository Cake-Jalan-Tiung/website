// Draws the shop's icons into public/ from the brand marks: the crowned Tiung, the square mark,
// for the home screen, and the Burung Tiung icon, the brand's mark for 32px and under, for the
// browser tab. Each is drawn on cream-100, the crowned mark's own ground, at the exact pixel size
// it is shown at, so nothing is scaled after. Run: pnpm icons
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {color} from '../src/system/tokens.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}public/`;
const ground = color['cream-100'];

// `fill` is the share of the side the mark's longer edge takes. A maskable icon may be cut to a
// circle by the launcher, so its mark fits the middle 80% (the safe zone) corner to corner.
const icons = [
  {file: 'apple-touch-icon.png', mark: 'crowned-tiung', size: 180, fill: 0.64},
  {file: 'icon-192.png', mark: 'crowned-tiung', size: 192, fill: 0.64},
  {file: 'icon-512.png', mark: 'crowned-tiung', size: 512, fill: 0.64},
  {file: 'icon-maskable-512.png', mark: 'crowned-tiung', size: 512, safe: 0.76},
];
const favicon = {file: 'favicon.ico', mark: 'burung-tiung-icon', sizes: [16, 32], fill: 0.88};

const browser = await chromium.launch();
const page = await browser.newPage();

async function draw(mark, size, fit) {
  const svg = readFileSync(`${root}assets/marks/${mark}.svg`, 'utf8').replace(/style="[^"]*"/, 'style="display: block; overflow: visible;"');
  await page.setViewportSize({width: size, height: size});
  await page.setContent(`<body style="margin: 0; background: ${ground};"><div id="icon" style="width: ${size}px; height: ${size}px; display: grid; place-items: center;">${svg}</div></body>`);
  // Framed on the drawing itself rather than the canvas Paper exported it on, so the mark sits
  // in the middle. getBBox leaves out stroke width, hence the margin.
  await page.evaluate(({size, fill, safe}) => {
    const svg = document.querySelector('svg');
    const box = svg.getBBox();
    const margin = 0.03 * Math.max(box.width, box.height);
    const width = box.width + 2 * margin;
    const height = box.height + 2 * margin;
    const scale = fill ? (fill * size) / Math.max(width, height) : (safe * size) / Math.hypot(width, height);
    svg.setAttribute('viewBox', `${box.x - margin} ${box.y - margin} ${width} ${height}`);
    svg.setAttribute('width', String(width * scale));
    svg.setAttribute('height', String(height * scale));
  }, {size, ...fit});
  return page.locator('#icon').screenshot();
}

for (const {file, mark, size, ...fit} of icons) {
  writeFileSync(`${out}${file}`, await draw(mark, size, fit));
  console.log(`public/${file}`);
}

// An .ico holding PNGs, which every browser that still asks for /favicon.ico reads.
const pngs = [];
for (const size of favicon.sizes) pngs.push({size, data: await draw(favicon.mark, size, {fill: favicon.fill})});
const directory = Buffer.alloc(6 + 16 * pngs.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(pngs.length, 4);
let offset = directory.length;
pngs.forEach(({size, data}, i) => {
  const entry = 6 + 16 * i;
  directory.writeUInt8(size, entry);
  directory.writeUInt8(size, entry + 1);
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(data.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
writeFileSync(`${out}${favicon.file}`, Buffer.concat([directory, ...pngs.map(({data}) => data)]));
console.log(`public/${favicon.file}`);

await browser.close();
