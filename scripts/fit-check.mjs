// Loads the site, its menu, the specimen and the worst-case page at six widths (and the home
// page's street at three laptop windows, where the hero must end at the fold) and fails if
// anything spills: an element past the viewport edge, content wider than its box, or
// content cut off by a box that clips.
//
//   pnpm fit                               starts vite, checks, stops it
//   FIT_URL=http://localhost:5179 pnpm fit   checks a running dev server
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {findSpills} from './spills.mjs';

const PAGES = ['/', '/menu', '/checkout', '/staff', '/offline', '/design-system', '/stress'];
const WIDTHS = [320, 390, 768, 900, 1024, 1440];
// Laptop windows wide enough for the home page's street, where the hero must be the first screen exactly.
const STREET = [[1280, 720], [1440, 800], [1920, 1080]];
const CASES = [...PAGES.flatMap((path) => WIDTHS.map((width) => ({path, width, height: 900}))), ...STREET.map(([width, height]) => ({path: '/', width, height, street: true}))];

async function withServer(run) {
  if (process.env.FIT_URL) return run(process.env.FIT_URL);
  const server = spawn('pnpm', ['exec', 'vite', '--port', '4180', '--strictPort'], {stdio: 'pipe'});
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('4180') && resolve());
    server.on('exit', (code) => reject(new Error(`vite exited ${code}`)));
  });
  try {
    return await run('http://localhost:4180');
  } finally {
    server.kill();
  }
}

const failures = await withServer(async (base) => {
  const browser = await chromium.launch();
  const failed = [];
  for (const {path, width, height, street} of CASES) {
    {
      const page = await browser.newPage({viewport: {width, height}});
      const errors = [];
      page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(base + path, {waitUntil: 'networkidle'});
      await page.evaluate(() => document.fonts.ready);
      const problems = [...(await page.evaluate(findSpills)), ...new Set(errors.map((text) => `console: ${text}`))];
      if (street) {
        const bottom = await page.evaluate(() => Math.round(document.querySelector('main > *').getBoundingClientRect().bottom));
        if (bottom !== height) problems.push(`the hero ends at ${bottom}px, not at the fold (${height}px)`);
      }
      console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${path} at ${width}${street ? `×${height}` : ''}${problems.length ? `\n        ${problems.slice(0, 8).join('\n        ')}${problems.length > 8 ? `\n        and ${problems.length - 8} more` : ''}` : ''}`);
      if (problems.length) failed.push(`${path} at ${width}${street ? `×${height}` : ''}`);
      await page.close();
    }
  }
  await browser.close();
  return failed;
});

console.log(`\n${CASES.length - failures.length}/${CASES.length} pages fit`);
process.exit(failures.length ? 1 : 0);
