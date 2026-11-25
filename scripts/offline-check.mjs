// The installed shop against a production build, on a phone: the manifest and its icons, the
// service worker taking the page, the home page and the menu opening and taking a dish with no
// connection, a page it has not kept leading to /offline and back, and nothing but /assets/
// files in the cache. Fails on any of those or on an error in the page.
//   pnpm offline                              builds, then serves the build with vite preview
//   OFFLINE_URL=http://localhost:4183 pnpm offline   checks a production server already running
//   OFFLINE_BROWSER=webkit ...                 the same in Safari's engine
import {execFileSync, spawn} from 'node:child_process';
import {chromium, webkit} from 'playwright-core';

const PORT = 4183;
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

async function withServer(run) {
  if (process.env.OFFLINE_URL) return run(process.env.OFFLINE_URL);
  execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], {stdio: 'inherit'});
  const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {stdio: 'pipe'});
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve());
    server.on('exit', (code) => reject(new Error(`vite preview exited ${code}`)));
  });
  try {
    return await run(`http://localhost:${PORT}`);
  } finally {
    server.kill();
  }
}

await withServer(async (base) => {
  const browser = await (process.env.OFFLINE_BROWSER === 'webkit' ? webkit : chromium).launch();
  const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  const errors = [];
  let offline = false;
  page.on('pageerror', (error) => errors.push(`uncaught on ${page.url().replace(/^https?:\/\/[^/]+/, '')}${offline ? ' offline' : ''}: ${error.message}`));
  // Offline, the browser logs each request it could not make, in its own words; those are expected here.
  const unreachable = /ERR_INTERNET_DISCONNECTED|Failed to load resource|Load failed|Cannot load|due to access control checks/;
  page.on('console', (message) => message.type() === 'error' && !unreachable.test(message.text()) && errors.push(message.text()));
  const heading = () => page.locator('h1').first().textContent();

  const manifest = await (await page.request.get(`${base}/manifest.webmanifest`)).json();
  check(manifest.start_url === '/menu' && manifest.display === 'standalone', `manifest opens ${manifest.start_url}, ${manifest.display}`);
  for (const icon of manifest.icons) {
    const response = await page.request.get(base + icon.src);
    check(response.ok() && response.headers()['content-type'] === 'image/png', `icon ${icon.src} (${icon.purpose})`);
  }

  await page.goto(`${base}/menu`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {timeout: 15_000});
  check(true, 'the service worker takes the page on the first visit');
  const cached = await page.evaluate(async () => {
    const paths = async (name) => (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname);
    return {pages: (await paths('cjt-pages-v1')).sort(), assets: await paths('cjt-assets-v1')};
  });
  check(cached.pages.join(' ') === '/ /menu /offline', `keeps ${cached.pages.join(' ')}`);
  check(cached.assets.length > 0 && cached.assets.every((path) => path.startsWith('/assets/')), `caches ${cached.assets.length} files, all under /assets/`);
  const photosKept = await page.evaluate(async () => {
    const assets = await caches.open('cjt-assets-v1');
    let photos = 0;
    for (let tries = 0, steady = 0; tries < 50 && steady < 3; tries++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const now = (await assets.keys()).filter((request) => request.url.endsWith('.webp')).length;
      steady = now > 0 && now === photos ? steady + 1 : 0;
      photos = now;
    }
    return photos;
  });
  check(photosKept > 0, `keeps the ${photosKept} photos the first visit showed`);

  await context.setOffline((offline = true));
  await page.goto(`${base}/menu`);
  check((await heading()) === 'Menu', 'the menu opens offline');
  const photos = await page.evaluate(() => [...document.querySelectorAll('main img')].filter((img) => img.complete).map((img) => img.naturalWidth > 0));
  check(photos.length > 0 && photos.every(Boolean), `${photos.filter(Boolean).length} of ${photos.length} photos on screen show offline`);
  await page.getByRole('button', {name: /^Add .* to bag$/}).first().click();
  check((await page.evaluate(() => localStorage.getItem('cjt.bag.v1') ?? '')).includes('quantity'), 'a dish goes in the bag offline');

  await page.goto(`${base}/`);
  check((await page.title()) === 'Cake Jalan Tiung — Shah Alam', 'the home page opens offline');
  // Its requests to the server fail before it is left: WebKit reports a request cut off by leaving as uncaught.
  await page.waitForLoadState('networkidle');

  await page.goto(`${base}/order/abc`);
  check(page.url() === `${base}/offline?from=%2Forder%2Fabc`, `a page not kept leads to ${page.url().replace(base, '')}`);
  check((await heading()) === 'You’re offline', 'the offline page says so');
  await page.getByRole('link', {name: 'See the menu'}).click();
  const menuShown = await page.locator('h1', {hasText: /^Menu$/}).waitFor({timeout: 5_000}).then(() => true, () => false);
  check(menuShown, `See the menu opens it offline (heading: ${await heading()})`);

  await context.setOffline((offline = false));
  await page.goto(`${base}/offline?from=%2Fcheckout`);
  await page.getByRole('button', {name: 'Try again'}).click();
  await page.waitForURL(`${base}/checkout`);
  check(true, 'Try again goes back to the page asked for');

  // An earlier deploy, as the cache would hold it: a kept menu naming a file this build lacks.
  await page.evaluate(async () => {
    const old = '/assets/earlier-deploy.js';
    await (await caches.open('cjt-assets-v1')).put(old, new Response('', {headers: {'Content-Type': 'text/javascript'}}));
    await (await caches.open('cjt-pages-v1')).put('/menu', new Response(`<script type="module" src="${old}"></script>`, {headers: {'Content-Type': 'text/html'}}));
  });
  await page.goto(`${base}/menu`);
  const afterDeploy = await page.evaluate(async () => {
    const assets = await caches.open('cjt-assets-v1');
    for (let tries = 0; tries < 30 && (await assets.match('/assets/earlier-deploy.js')); tries++) await new Promise((resolve) => setTimeout(resolve, 100));
    const menu = await (await (await caches.open('cjt-pages-v1')).match('/menu')).text();
    return {oldGone: !(await assets.match('/assets/earlier-deploy.js')), menuFresh: !menu.includes('earlier-deploy') && menu.includes('/assets/'), left: (await assets.keys()).length};
  });
  check(afterDeploy.menuFresh, 'a menu loaded online replaces the kept copy');
  check(afterDeploy.oldGone && afterDeploy.left > 0, `files of an earlier deploy are let go (${afterDeploy.left} kept)`);

  check(errors.length === 0, errors.length ? `errors in the page:\n  ${errors.join('\n  ')}` : 'no errors in the page');
  await browser.close();
});

if (failures.length) {
  console.error(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nworks offline');
