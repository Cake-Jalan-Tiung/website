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
await page.waitForTimeout(400);
expect(/^(Open|Closed) now · Pick-up /.test((await page.getByText(/ now · Pick-up /).first().textContent()) ?? ''), 'the menu says whether the shop is open and the soonest pick-up');
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
expect((await page.getByRole('link', {name: /^\d+ View bag/}).textContent())?.includes('Pick-up '), 'the bag bar gives the soonest pick-up for the bag');
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
// The add-on row offers what the bag lacks; one tap moves a dish into the bag and out of the row.
const addOns = page.getByRole('region', {name: 'Add to your order'});
const offered = addOns.getByRole('button', {name: /^Add .* to bag$/}).first();
const offeredName = (await offered.getAttribute('aria-label'))?.replace(/^Add (.*) to bag$/, '$1');
await offered.click();
await page.waitForTimeout(600);
expect((await page.locator('[data-line]').allTextContents()).some((line) => offeredName && line.includes(offeredName)), 'an add-on joins the bag');
expect((await addOns.getByRole('button', {name: `Add ${offeredName} to bag`}).count()) === 0, 'an added add-on leaves the row');
await screen('checkout-add-on');
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
const pickupAt = await page.getByLabel('Time').inputValue();
await pay();
await page.getByRole('button', {name: /^Pay$/}).click();
await page.waitForURL(/\/order\//);
await settle();
await screen('order-paid', {full: true});
const orderUrl = page.url();
const orderCode = (await page.locator('p').filter({hasText: /^[0-9A-F]{6}$/}).first().textContent())?.trim();

// Back on the home page, the order in the kitchen is one tap away.
await page.goto(`${base}/`, {waitUntil: 'networkidle'});
await settle();
expect((await page.getByRole('link', {name: new RegExp(`Order ${orderCode}.*Track`)}).count()) === 1, 'home leads back to the order in the kitchen');
expect((await page.getByRole('link', {name: /^\d+ View bag/}).count()) === 0, 'the paid bag is empty');
// A bag started now survives opening the order page again.
await page.goto(`${base}/menu`, {waitUntil: 'networkidle'});
await page.getByRole('button', {name: /^Add .* to bag$/}).first().click();
await page.goto(orderUrl, {waitUntil: 'networkidle'});
await settle();
await page.waitForTimeout(4500);
await page.goto(`${base}/`, {waitUntil: 'networkidle'});
await settle();
expect((await page.getByRole('link', {name: /^1 View bag/}).count()) === 1, 'revisiting a paid order leaves a new bag alone');
await page.evaluate(() => localStorage.removeItem('cjt.bag.v1'));
await page.reload({waitUntil: 'networkidle'});
await settle();
await screen('home-tracking');
// I'm here opens near the pick-up time, so a tap at home cannot ring the kitchen.
const arrivalOpen = Date.now() >= Date.parse(pickupAt) - 45 * 60_000;
await page.goto(orderUrl, {waitUntil: 'networkidle'});
await settle();
expect(arrivalOpen || (await page.getByRole('button', {name: 'I’m here'}).count()) === 0, 'I’m here waits for the pick-up time to come near');
// At the shop, ten minutes before pick-up: I'm here tells the counter.
await page.clock.setFixedTime(new Date(Date.parse(pickupAt) - 10 * 60_000));
await page.goto(orderUrl, {waitUntil: 'networkidle'});
await settle();
await page.getByRole('button', {name: 'I’m here'}).click();
await page.waitForTimeout(800);
expect((await page.getByText('The counter knows you’re here').count()) === 1, 'I’m here is acknowledged');
await screen('order-arrived');

if (process.env.WALK_STAFF_PIN) {
  const code = orderCode;
  const staff = await context.newPage();
  await staff.goto(`${base}/staff`, {waitUntil: 'networkidle'});
  if (await staff.getByLabel('Staff PIN').count()) {
    await staff.getByLabel('Staff PIN').fill(process.env.WALK_STAFF_PIN);
    await staff.getByRole('button', {name: 'Sign in'}).click();
    await staff.waitForTimeout(1500);
  }
  const ticket = staff.getByRole('article', {name: new RegExp(`^Order ${code} `)});
  expect((await ticket.getByText(/^Customer is here · since /).count()) === 1, 'the kitchen sees the customer has arrived');
  await staff.screenshot({path: `${out}/staff-arrived.png`});
  await ticket.getByRole('button', {name: 'Accept'}).click();
  await staff.waitForTimeout(1000);
  await ticket.getByRole('button', {name: 'Mark ready'}).click();
  await staff.waitForTimeout(1000);
  await page.goto(orderUrl, {waitUntil: 'networkidle'});
  await settle();
  expect((await page.title()).startsWith('Ready to collect'), 'the tab title says the order is ready');
  await screen('order-ready');
  await ticket.getByRole('button', {name: 'Collected'}).click();
  await staff.waitForTimeout(1000);
  await staff.close();
  await page.goto(orderUrl, {waitUntil: 'networkidle'});
  await settle();
  await screen('order-collected');

  // Next visit: the same order goes back into the bag in one tap.
  await page.goto(`${base}/menu`, {waitUntil: 'networkidle'});
  await settle();
  await screen('menu-order-again');
  await page.getByRole('button', {name: /^Order again: /}).click();
  await page.waitForURL(/\/checkout$/);
  await page.waitForTimeout(800);
  expect((await page.locator('[data-line]').count()) > 0, 'Order again fills the bag and opens checkout');
  const reordered = await page.evaluate(() => localStorage.getItem('cjt.bag.v1'));
  await page.goBack({waitUntil: 'networkidle'});
  await settle();
  await page.getByRole('button', {name: /^Order again: /}).click();
  await page.waitForURL(/\/checkout$/);
  await page.waitForTimeout(800);
  expect((await page.evaluate(() => localStorage.getItem('cjt.bag.v1'))) === reordered, 'a second Order again does not double the bag');
  await screen('checkout-order-again');
}

await browser.close();
console.log(orderUrl);
if (failed.length) console.log(`failed:\n  ${failed.join('\n  ')}`);
if (spills.length) console.log(`spills:\n  ${[...new Set(spills)].join('\n  ')}`);
console.log(errors.length ? `console errors:\n  ${errors.join('\n  ')}` : 'no console errors');
process.exit(failed.length || spills.length || errors.length ? 1 : 0);
