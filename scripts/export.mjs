// Writes the exportable pieces from the Applications chapter as PNGs at the size they are
// used (the social posts at 1080 wide, the receipt header at the printer's 576 dots), and
// fails if a file comes out any other size.
//
//   pnpm export                                starts vite, writes exports/, stops it
//   EXPORT_URL=http://localhost:5179 pnpm export   uses a running dev server
import {mkdirSync, readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const OUT = 'exports';

async function withServer(run) {
  if (process.env.EXPORT_URL) return run(process.env.EXPORT_URL);
  const server = spawn('pnpm', ['exec', 'vite', '--port', '4181', '--strictPort'], {stdio: 'pipe'});
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('4181') && resolve());
    server.on('exit', (code) => reject(new Error(`vite exited ${code}`)));
  });
  try {
    return await run('http://localhost:4181');
  } finally {
    server.kill();
  }
}

// A PNG's width and height are the first two fields of its IHDR chunk.
const pngSize = (file) => {
  const bytes = readFileSync(file);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
};

async function open(browser, url, deviceScaleFactor) {
  const page = await browser.newPage({viewport: {width: 640, height: 900}, deviceScaleFactor});
  const errors = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(`console: ${message.text()}`));
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  return {page, errors};
}

const failures = await withServer(async (base) => {
  mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch();
  const url = `${base}/export`;
  const index = await open(browser, url, 1);
  const pieces = await index.page.$$eval('[data-export]', (els) => els.map((el) => ({id: el.dataset.export, posted: el.dataset.posted, scale: Number(el.dataset.scale)})));
  const failed = [...index.errors];
  await index.page.close();
  // Each piece is photographed on a page whose device pixel ratio is its own scale.
  for (const scale of new Set(pieces.map((piece) => piece.scale))) {
    const {page, errors} = await open(browser, url, scale);
    for (const {id, posted} of pieces.filter((piece) => piece.scale === scale)) {
      const file = `${OUT}/${id}-${posted}.png`;
      const artboard = page.locator(`[data-export="${id}"]`);
      // An artboard clips at its edge, so content larger than it would be cut off in the file.
      const clipped = await artboard.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      await artboard.screenshot({path: file});
      const got = pngSize(file);
      const problem = got !== posted ? ` came out ${got}` : clipped ? ' clips its content' : '';
      console.log(`${problem ? 'FAIL' : 'ok  '}  ${file}${problem}`);
      if (problem) failed.push(file);
    }
    failed.push(...errors);
    await page.close();
  }
  await browser.close();
  return failed;
});

if (failures.length) console.log(`\n${failures.join('\n')}`);
process.exit(failures.length ? 1 : 0);
