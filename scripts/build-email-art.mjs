// Draws the brand marks the order emails show (src/orders/email.ts) as PNGs in public/email/:
// mail apps do not show SVG. Each is drawn on the ground it sits on in the email, at three times
// its shown width, so it stays sharp on a phone and keeps its colour where a mail app darkens
// the page. Also copies Jost there, for the mail apps that load web fonts. Run: pnpm email-art
import {copyFileSync, mkdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {color} from '../src/system/tokens.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}public/email/`;
const SCALE = 3;

// `width` is the width each is shown at in the email, in px; email.ts reads the same numbers from EMAIL_ART.
const art = [
  {name: 'lockup', mark: 'primary-lockup', width: 260, ground: 'cream-100'},
  {name: 'tiung', mark: 'burung-tiung', width: 112, ground: 'cream-100'},
  {name: 'tiung-icon', mark: 'burung-tiung-icon', width: 32, ground: 'paper'},
];

mkdirSync(out, {recursive: true});
const browser = await chromium.launch();
const page = await browser.newPage({deviceScaleFactor: SCALE});
for (const {name, mark, width, ground} of art) {
  // Paper's export fills its parent's height; here the width sets the size.
  const svg = readFileSync(`${root}assets/marks/${mark}.svg`, 'utf8').replace(/style="[^"]*"/, 'style="display: block; width: 100%; height: auto;"');
  await page.setContent(`<body style="margin: 0; background: ${color[ground]};"><div id="art" style="width: ${width}px; line-height: 0;">${svg}</div></body>`);
  await page.locator('#art').screenshot({path: `${out}${name}.png`});
  console.log(`public/email/${name}.png`);
}
await browser.close();

copyFileSync(`${root}node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2`, `${out}jost.woff2`);
console.log('public/email/jost.woff2');
