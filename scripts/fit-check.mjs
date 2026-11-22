// Loads the site, the specimen and the worst-case page at six widths and fails if
// anything spills: an element past the viewport edge, content wider than its box, or
// content cut off by a box that clips.
//
//   pnpm fit                               starts vite, checks, stops it
//   FIT_URL=http://localhost:5179 pnpm fit   checks a running dev server
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const PAGES = ['/', '/design-system.html', '/stress.html'];
const WIDTHS = [320, 390, 768, 900, 1024, 1440];

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

function findSpills() {
  const viewport = document.documentElement.clientWidth;
  const name = (el) => `${el.tagName.toLowerCase()}${el.dataset?.cjt ? `[${el.dataset.cjt}]` : ''} "${(el.textContent ?? '').trim().slice(0, 24)}"`;
  const spills = new Set();
  if (document.documentElement.scrollWidth > viewport) spills.add(`the page scrolls sideways by ${document.documentElement.scrollWidth - viewport}px`);
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;
    if (box.right > viewport + 0.5 || box.left < -0.5) spills.add(`${name(el)} leaves the viewport (${Math.round(box.left)} to ${Math.round(box.right)} of ${viewport})`);
    const style = getComputedStyle(el);
    if (style.display !== 'inline' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) spills.add(`${name(el)} holds content ${el.scrollWidth - el.clientWidth}px wider than itself`);
    if (style.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) spills.add(`${name(el)} cuts off ${el.scrollHeight - el.clientHeight}px of its content`);
  }
  return [...spills];
}

const failures = await withServer(async (base) => {
  const browser = await chromium.launch();
  const failed = [];
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({viewport: {width, height: 900}});
      const errors = [];
      page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(base + path, {waitUntil: 'networkidle'});
      await page.evaluate(() => document.fonts.ready);
      const problems = [...(await page.evaluate(findSpills)), ...new Set(errors.map((text) => `console: ${text}`))];
      console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${path} at ${width}${problems.length ? `\n        ${problems.slice(0, 8).join('\n        ')}${problems.length > 8 ? `\n        and ${problems.length - 8} more` : ''}` : ''}`);
      if (problems.length) failed.push(`${path} at ${width}`);
      await page.close();
    }
  }
  await browser.close();
  return failed;
});

console.log(`\n${PAGES.length * WIDTHS.length - failures.length}/${PAGES.length * WIDTHS.length} pages fit`);
process.exit(failures.length ? 1 : 0);
