// Walks the customer's path on a phone, home to paid, saving a screenshot of every screen and
// checking each for spills at 390 and 320 wide. Exits non-zero on a spill or a console error.
// With WALK_STAFF_PIN set it also signs in to /staff and moves the paid order to Ready, and, on a
// build that delivers, books a rider and follows the stand-in ride to Delivered.
//
//   WALK_URL=http://localhost:5179 node scripts/walk.mjs <out-dir>
//   WALK_BROWSER=webkit ...   the same walk in Safari's engine (once: pnpm exec playwright-core install webkit)
import {mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium, webkit} from 'playwright-core';
import {findSpills} from './spills.mjs';

const base = process.env.WALK_URL ?? 'http://localhost:5179';
const out = process.argv[2] ?? join(tmpdir(), 'cjt-walk');
mkdirSync(out, {recursive: true});

const browser = await (process.env.WALK_BROWSER === 'webkit' ? webkit : chromium).launch();
const phone = {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true};
const context = await browser.newContext(phone);
const page = await context.newPage();
const errors = [];
const spills = [];
const failed = [];
const expect = (ok, what) => ok || failed.push(what);
page.on('console', (m) => m.type() === 'error' && errors.push(`${new URL(page.url()).pathname}: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`${new URL(page.url()).pathname}: ${String(e)}`));

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
// The foot of a phone's screen holds Order for pick-up once the hero's own button has scrolled
// away, never both at once, and it opens the menu in place: the page is not loaded again.
const footOrder = page.getByRole('complementary', {name: 'Order'});
expect(!(await footOrder.isVisible()), 'the foot bar waits while the hero button is in sight');
await page.evaluate(() => window.scrollTo(0, 1600));
await page.waitForTimeout(600);
expect(await footOrder.isVisible(), 'the foot bar offers Order for pick-up once the hero button is gone');
await screen('home-foot-bar');
await page.evaluate(() => (window.walkMark = 'home'));
await footOrder.getByRole('link').click();
await page.waitForURL(/\/menu$/);
await page.waitForTimeout(400);
expect(await page.evaluate(() => window.walkMark === 'home'), 'the menu opens in place, without loading the page again');
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
await page.getByRole('button', {name: /^Add RM /}).click();
await page.waitForTimeout(600);
// Taking a dish back out through the sheet: its count, down to nothing, Remove.
await add.nth(2).click();
await page.getByRole('button', {name: /^Change .*, 1 in bag$/}).nth(2).click();
await page.waitForTimeout(600);
await page.getByRole('button', {name: /^One less /}).click();
await page.getByRole('button', {name: 'Remove from bag'}).click();
await page.waitForTimeout(600);
expect((await page.getByRole('link', {name: /^View bag · /}).textContent())?.includes('View bag · 3 items'), 'the removed dish left the bag');
expect((await page.getByRole('link', {name: /^View bag · /}).textContent())?.includes('Pick-up '), 'the bag bar gives the soonest pick-up for the bag');
expect((await page.getByRole('button', {name: /^Change London to Shah Alam - Cake Slice, \d+ in bag$/}).count()) === 2, 'a best seller in the bag shows its count on the strip and on its row');
expect(!(await page.getByRole('link', {name: /^Bag, /}).isVisible()), 'on a phone the bag is at the foot of the screen, not also in the header');
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

await page.evaluate(() => (window.walkMark = 'menu'));
await page.getByRole('link', {name: /^View bag · /}).click();
await page.waitForURL(/\/checkout$/);
expect(await page.evaluate(() => window.walkMark === 'menu'), 'View bag opens checkout in place');

// First order: the payment is cancelled, and the customer is offered another try.
await checkout();
await screen('checkout');
// The add-on row offers what the bag lacks; one tap moves a dish into the bag and out of the row.
const addOns = page.getByRole('region', {name: 'Add to your bag'});
const offered = addOns.getByRole('button', {name: /^Add .* to bag$/}).first();
const offeredName = (await offered.getAttribute('aria-label'))?.replace(/^Add (.*) to bag$/, '$1');
await offered.click();
await page.waitForTimeout(600);
expect((await page.locator('[data-line]').allTextContents()).some((line) => offeredName && line.includes(offeredName)), 'an add-on joins the bag');
expect((await addOns.getByRole('button', {name: `Add ${offeredName} to bag`}).count()) === 0, 'an added add-on leaves the row');
expect(await page.evaluate(() => document.activeElement?.closest('[data-line]') !== null), 'focus follows an added add-on into the bag');
expect(/^Pay RM/.test((await page.getByRole('button', {name: /^(Pay|Updating)/}).textContent()) ?? ''), 'Pay shows the total for the bag as it is now');
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

// Back on the home page, the order in the kitchen is one tap away, on a card that rises a beat after the page.
await page.goto(`${base}/`, {waitUntil: 'networkidle'});
await settle();
const lastOrder = page.getByRole('region', {name: 'Your last order'});
expect(await lastOrder.waitFor({timeout: 5000}).then(() => true, () => false), 'the last order rises as a card');
await screen('home-last-order');
expect((await page.getByRole('link', {name: new RegExp(`^Track your order, ${orderCode}`)}).count()) === 1, 'home leads back to the order in the kitchen');
expect((await page.getByRole('link', {name: /^View bag · /}).count()) === 0, 'the paid bag is empty');
// A bag started now survives opening the order page again.
await page.goto(`${base}/menu`, {waitUntil: 'networkidle'});
await page.getByRole('button', {name: /^Add .* to bag$/}).first().click();
await page.goto(orderUrl, {waitUntil: 'networkidle'});
await settle();
await page.waitForTimeout(4500);
await page.goto(`${base}/`, {waitUntil: 'networkidle'});
await settle();
expect((await page.getByRole('link', {name: /^View bag · 1 item /}).count()) === 1, 'revisiting a paid order leaves a new bag alone');
await page.evaluate(() => localStorage.removeItem('cjt.bag.v1'));
await page.reload({waitUntil: 'networkidle'});
await settle();
await screen('home-tracking');
// I'm here opens near the pick-up time or once the order is ready, so a tap at home cannot ring the kitchen.
await page.goto(orderUrl, {waitUntil: 'networkidle'});
await settle();
expect((await page.getByRole('button', {name: 'I’m here'}).count()) === 0, 'I’m here waits until pick-up is near or the order is ready');

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
  await ticket.getByRole('button', {name: 'Accept'}).click();
  await staff.waitForTimeout(1000);
  await ticket.getByRole('button', {name: 'Mark ready'}).click();
  // The customer's page, left open, follows by itself: no reload.
  expect(await page.waitForFunction(() => document.title.startsWith('Ready to collect'), null, {timeout: 8000}).then(() => true, () => false), 'the open order page turns Ready by itself, title and all');
  // Ready: I'm here is open, and tells the counter.
  await page.getByRole('button', {name: 'I’m here'}).click();
  await page.waitForTimeout(800);
  expect((await page.getByRole('status').filter({hasText: 'The counter knows you’re here'}).count()) === 1, 'I’m here is acknowledged in a status');
  expect(await page.getByRole('status').filter({hasText: 'The counter knows you’re here'}).evaluate((el) => el === document.activeElement), 'focus moves to the acknowledgement');
  await screen('order-arrived');
  expect(await ticket.getByText(/^Customer is here · since /).waitFor({timeout: 8000}).then(() => true, () => false), 'the kitchen sees the customer has arrived');
  await staff.screenshot({path: `${out}/staff-arrived.png`});
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

  // Paid, but the payment page never comes back to the order (a bank app kept the customer).
  // Back at checkout, the customer is taken to the paid order instead of being offered Pay again.
  await pay();
  await page.route(/\/order\//, (route) => route.abort());
  await page.getByRole('button', {name: /^Pay$/}).click();
  await page.waitForTimeout(1500);
  await page.unroute(/\/order\//);
  await page.goto(`${base}/checkout`, {waitUntil: 'networkidle'});
  expect(await page.waitForURL(/\/order\//, {timeout: 8000}).then(() => true, () => false), 'checkout sends a bag already paid for to its order');
  expect((await page.evaluate(() => localStorage.getItem('cjt.bag.v1'))) === '[]', 'the bag that was paid for is empty');
}

// The card never blocks the page: Close puts it away for the rest of the visit.
await page.goto(`${base}/`, {waitUntil: 'networkidle'});
await lastOrder.waitFor({timeout: 5000});
await lastOrder.getByRole('button', {name: 'Close'}).click();
await page.waitForTimeout(400);
await page.reload({waitUntil: 'networkidle'});
await page.waitForTimeout(1500);
expect((await lastOrder.count()) === 0, 'a closed last-order card stays away for the visit');

// Delivery, on a build that offers it (DELIVERY=fake in `vite dev`): find the address, see it
// refused when too far, price it, pay, and follow the stand-in rider to the door.
await page.evaluate(() => localStorage.setItem('cjt.bag.v1', JSON.stringify([{dishId: 'shio-pan', quantity: 2}])));
await page.goto(`${base}/checkout`, {waitUntil: 'networkidle'});
await settle();
if (await page.getByRole('radio', {name: 'Delivery'}).count()) {
  await page.getByRole('radio', {name: 'Delivery'}).check();
  const search = page.getByRole('combobox', {name: /search for your address/i});
  await search.fill('test');
  await page.getByRole('option', {name: /Test address C/}).click();
  await page.getByLabel(/House, unit or floor/).fill('No. 12');
  await page.getByRole('button', {name: 'Deliver here'}).click();
  expect(await page.getByText(/^We deliver up to \d+ km/).waitFor({timeout: 8000}).then(() => true, () => false), 'an address past the area is refused before paying');
  await page.getByRole('button', {name: 'Change'}).click();
  await search.fill('test');
  await page.getByRole('option', {name: /Test address B/}).click();
  await page.getByRole('button', {name: 'Deliver here'}).click();
  expect(await page.getByText(/^Delivery · /).first().waitFor({timeout: 8000}).then(() => true, () => false), 'the delivery fee joins the bag');
  expect(/RM/.test((await page.getByRole('button', {name: /^Pay/}).textContent()) ?? ''), 'Pay carries the total with delivery');
  await screen('checkout-delivery', {full: true});
  await page.getByRole('button', {name: /^Pay/}).click();
  await page.waitForURL(/\/pay\/test\//, {timeout: 30000});
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: 'Pay', exact: true}).click();
  await page.waitForURL(/\/order\//, {timeout: 30000});
  const deliveryUrl = page.url();
  await settle();
  expect((await page.getByRole('heading', {name: 'Delivery'}).count()) === 1, 'the order page says where it is going');
  expect((await page.getByRole('button', {name: 'I’m here'}).count()) === 0, 'a delivery has no I’m here');
  await screen('order-delivery');
  if (process.env.WALK_STAFF_PIN) {
    const code = deliveryUrl.split('/order/')[1].slice(0, 6).toUpperCase();
    const staff = await context.newPage();
    await staff.goto(`${base}/staff`, {waitUntil: 'networkidle'});
    const ticket = staff.getByRole('article', {name: new RegExp(`^Delivery ${code} `)});
    await ticket.getByRole('button', {name: 'Accept'}).click();
    await staff.waitForTimeout(800);
    // In opening hours a delivery due soon is booked at payment; otherwise the kitchen books it early.
    if (await ticket.getByRole('button', {name: 'Book rider now'}).count()) await ticket.getByRole('button', {name: 'Book rider now'}).click();
    expect(await ticket.getByText('Finding a rider').waitFor({timeout: 8000}).then(() => true, () => false), 'the rider is booked, at payment or by the kitchen');
    await staff.close();
    for (const [button, heading] of [['Rider found', 'Rider on the way'], ['Picked up', 'On the way'], ['Delivered', 'Delivered']]) {
      await page.goto(deliveryUrl.replace('/order/', '/deliver/test/'), {waitUntil: 'networkidle'});
      await page.getByRole('button', {name: button}).click();
      await page.waitForURL(/\/order\//);
      expect(await page.getByRole('heading', {level: 1, name: heading}).waitFor({timeout: 8000}).then(() => true, () => false), `${button}: the order page says ${heading}`);
    }
    await settle();
    await screen('order-delivered');
  }
}

await browser.close();
console.log(orderUrl);
if (failed.length) console.log(`failed:\n  ${failed.join('\n  ')}`);
if (spills.length) console.log(`spills:\n  ${[...new Set(spills)].join('\n  ')}`);
console.log(errors.length ? `console errors:\n  ${errors.join('\n  ')}` : 'no console errors');
process.exit(failed.length || spills.length || errors.length ? 1 : 0);
