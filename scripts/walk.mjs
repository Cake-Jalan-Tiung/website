// Walks the customer's path on a phone, home to paid, saving a screenshot of every screen and
// checking each for spills at 390 and 320 wide. Exits non-zero on a spill or a console error.
// With WALK_STAFF_PIN set it also signs in to /staff and moves the paid order to Ready.
//
//   WALK_URL=http://localhost:5179 node scripts/walk.mjs <out-dir>
import {mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import {findSpills} from './spills.mjs';

const base = process.env.WALK_URL ?? 'http://localhost:5179';
const out = process.argv[2] ?? join(tmpdir(), 'cjt-walk');
mkdirSync(out, {recursive: true});

const browser = await chromium.launch();
const phone = {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true};
const context = await browser.newContext(phone);
const page = await context.newPage();
const errors = [];
const spills = [];
const failed = [];
const expect = (ok, what) => ok || failed.push(what);
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

let n = 0;
async function screen(name, {full = false} = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({path: `${out}/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full});
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: 844});
    await page.waitForTimeout(150);
    for (const problem of await page.evaluate(findSpills)) spills.push(`${name} at ${width}: ${problem}`);
  }
  await page.setViewportSize(phone.viewport);
}
const settle = async () => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
};

await page.goto(`${base}/`, {waitUntil: 'networkidle'});
await screen('home');
await screen('home-full', {full: true});
// The shopfront's door opens onto the counter, and Back outside returns to the street.
await page.getByRole('button', {name: /^Open the door/}).click();
await page.waitForTimeout(2800);
expect(await page.getByRole('button', {name: '← Back outside'}).evaluate((el) => el === document.activeElement), 'opening the door moves focus inside');
await screen('home-inside');
await page.getByRole('button', {name: '← Back outside'}).click();
await page.waitForTimeout(1500);
expect(await page.getByRole('button', {name: /^Open the door/}).evaluate((el) => el === document.activeElement), 'coming back out returns focus to the door');
await page.goto(`${base}/menu`, {waitUntil: 'networkidle'});
await screen('menu');
const pastries = page.getByRole('navigation', {name: 'Categories'}).getByRole('link', {name: 'Pastries'});
await pastries.click();
await page.waitForTimeout(1200);
expect((await pastries.getAttribute('aria-current')) === 'true', 'a tapped category is the one the rail marks');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
const add = page.getByRole('button', {name: /^Add .* to bag$/});
await add.nth(0).click();
await add.nth(1).click();
await page.getByRole('button', {name: 'Raspberry & Vanilla - Slice', exact: true}).click();
await page.waitForTimeout(600);
await screen('dish-sheet');
await page.getByRole('button', {name: /^Add · /}).click();
await page.waitForTimeout(600);
// Taking a dish back out through the sheet: its count, down to nothing, Remove.
await add.nth(2).click();
await page.getByRole('button', {name: /^1 .* in bag, change$/}).nth(2).click();
await page.waitForTimeout(600);
await page.getByRole('button', {name: /^One less /}).click();
await page.getByRole('button', {name: 'Remove from bag'}).click();
await page.waitForTimeout(600);
expect((await page.getByRole('link', {name: /^\d+ View bag/}).textContent())?.includes('3'), 'the removed dish left the bag');
await page.evaluate(() => window.scrollTo(0, 2400));
await screen('menu-with-bag');

const checkout = async () => {
  await page.goto(`${base}/checkout`, {waitUntil: 'networkidle'});
  await page.waitForTimeout(800);
};
const pay = async () => {
  await page.getByRole('button', {name: /^Pay/}).click();
  await page.waitForURL(/\/pay\/test\//, {timeout: 15000});
  await settle();
};

// First order: the payment is cancelled, and the customer is offered another try.
await checkout();
await screen('checkout');
await page.getByRole('button', {name: /^Pay/}).click();
await page.waitForTimeout(800);
expect(await page.getByLabel('Name').evaluate((el) => el === document.activeElement), 'Pay with no details takes the customer to Name');
await screen('checkout-guided');
await page.getByLabel('Name').fill('Aina');
await page.getByLabel('Mobile number').fill('012-345 6789');
await page.getByLabel('Email').fill('aina@example.com');
await page.locator('input[name="method"]').first().check({force: true});
await screen('checkout-filled', {full: true});
await pay();
await screen('pay-provider');
// Leaving the payment page unpaid: the order waits for payment.
const pending = page.url().replace('/pay/test/', '/order/');
await page.goto(pending, {waitUntil: 'networkidle'});
await settle();
await screen('order-awaiting');
await page.goBack({waitUntil: 'networkidle'});
await page.getByRole('button', {name: 'Cancel payment'}).click();
await page.waitForURL(/\/order\//);
await settle();
await screen('order-cancelled');

// Second order, as a returning customer: details and way to pay are remembered.
await checkout();
await screen('checkout-returning', {full: true});
await pay();
await page.getByRole('button', {name: /^Pay$/}).click();
await page.waitForURL(/\/order\//);
await settle();
await screen('order-paid', {full: true});
const orderUrl = page.url();

if (process.env.WALK_STAFF_PIN) {
  const code = (await page.locator('p').filter({hasText: /^[0-9A-F]{6}$/}).first().textContent())?.trim();
  const staff = await context.newPage();
  await staff.goto(`${base}/staff`, {waitUntil: 'networkidle'});
  if (await staff.getByLabel('Staff PIN').count()) {
    await staff.getByLabel('Staff PIN').fill(process.env.WALK_STAFF_PIN);
    await staff.getByRole('button', {name: 'Sign in'}).click();
    await staff.waitForTimeout(1500);
  }
  const ticket = staff.getByRole('article', {name: new RegExp(`^Order ${code} `)});
  await ticket.getByRole('button', {name: 'Accept'}).click();
  await staff.waitForTimeout(1000);
  await ticket.getByRole('button', {name: 'Mark ready'}).click();
  await staff.waitForTimeout(1000);
  await staff.close();
  await page.goto(orderUrl, {waitUntil: 'networkidle'});
  await settle();
  await screen('order-ready');
}

await browser.close();
console.log(orderUrl);
if (failed.length) console.log(`failed:\n  ${failed.join('\n  ')}`);
if (spills.length) console.log(`spills:\n  ${[...new Set(spills)].join('\n  ')}`);
console.log(errors.length ? `console errors:\n  ${errors.join('\n  ')}` : 'no console errors');
process.exit(failed.length || spills.length || errors.length ? 1 : 0);
