# Own checkout

Goal: customers order and pay on the shop's own site instead of Beep, in a flow clearly better than Beep's, and the same build serves other F&B clients (one deploy per client).

## Decisions

- **Stack.** TanStack Start on Cloudflare Workers, built and deployed with `cf` (`cloudflare.config.ts`, no Wrangler). D1 for orders.
- **Payments.** CHIP (CHIP Collect). The client opens the merchant account; we need its test secret key and `brand_id`.
- **Fulfilment.** Pick-up only at launch, with a chosen time. Delivery is a later phase.
- **Kitchen.** A staff screen at `/staff` on a tablet, signed in with the shop's PIN. StoreHub POS was the first choice and is blocked (see Findings); if StoreHub ever opens an order API, it reads the same paid orders.
- **Multi-client.** Every table carries `shop_id`. Nothing more multi-tenant than that until a second client is live.

## Findings

- **Astryx renders on the server.** `/`, `/menu` and `/design-system` render on Workers with their CSS and photos in the HTML, and hydrate without errors (checked in the browser on 23 Nov 2026).
- **CHIP picker.** `GET /payment_methods/?brand_id&currency=MYR&amount` lists the methods (FPX, DuitNow QR `duitnow_qr`, Touch 'n Go `razer_tng`, GrabPay `razer_grabpay`, ShopeePay, cards, Apple Pay, Google Pay). Opening `checkout_url?preferred=<method>` goes straight to that method, so the method choice can live on our checkout page. From the docs, not yet tested: cards still land on CHIP's card form, and FPX probably still asks for the bank there. Direct Post (our own card form) is card-only, enabled per merchant, and widens PCI scope; not planned.
- **CHIP webhooks.** `X-Signature` is base64 RSA PKCS#1 v1.5 over SHA-256 of the raw body. Callbacks retry up to 8 times and can arrive twice. `success_callback` rejects URLs with an explicit port, so local testing needs a tunnel.
- **CHIP requires `client.email`** on every purchase, so checkout asks for an email (it also carries the receipt).
- **StoreHub can record our sales, not take kitchen orders.** StoreHub's API document (REST APIs v1.5, Nov 2019, sent with the shop's credentials) has `POST /transactions` (Add Transaction) and `POST /transactions/<refId>/cancel`, besides reads for products, customers, inventory, stores, employees and timesheets. Add Transaction records a finished Sale: `refId` (repeats are ignored), `storeId`, StoreHub `productId` per item, tax-exclusive totals, and `paymentMethod` limited to `Cash` or `CreditCard`. It has no pick-up time or order status, so the kitchen still works from `/staff`; what it gives is web sales in StoreHub's reports and stock. Host `api.storehubhq.com`, Basic auth (username `cakejalantiung`, password the API token), about 3 calls a second before rate limiting. Earlier sources (a StoreHub Care article, an unofficial client) called it read-only; the document supersedes them.

## Order model

Money is integer sen end to end. The server prices every cart from the catalog; the browser sends only dish ids and quantities.

```
orders        id, shop_id, status, pickup_at, customer_name, phone, email, note,
              total_sen, chip_purchase_id, created_at, paid_at, updated_at
order_items   order_id, dish_id, name, unit_price_sen, quantity     (snapshot at order time)
chip_events   purchase_id + event_type + created_on (unique), order_id, received_at, body
```

Status moves one way: `awaiting_payment → paid → accepted → ready → collected`, with `awaiting_payment → expired | cancelled`, `expired → paid` (money arrived late) and `paid/accepted/ready → refunded`. The moves live in one table in `src/orders/model.ts`; each is one guarded `UPDATE … WHERE status IN (<allowed from>)`, so a duplicate or late event changes nothing. Payment events are recorded once by id (`payment_events`).

## Flow

1. Cart in the browser (dish id, quantity), kept across visits.
2. Checkout on one page: pick-up time (open slots only, read in the shop's time zone, Thursday closed, breakfast items only in their window), name, phone, email, payment method.
3. `createOrder` server function: validate, price from the catalog, insert the order as `awaiting_payment`, create the CHIP purchase (`reference` = order id, `due` = now + 30 min with `due_strict`, `success_callback`, `success_redirect` = the order page), redirect to `checkout_url?preferred=<method>`.
4. CHIP callback: verify the signature over the raw body, record the event, confirm with `GET /purchases/{id}/`, move the order to `paid`, hand it to the `OrderSink`.
5. Order page `/order/<id>`: status as it changes, pick-up time and place, receipt.

## Phases

Each phase ends in a check that is run, not assumed.

1. **Start on Workers.** Done. `/`, `/menu`, `/design-system` render on the server; typecheck, 721 tests, fit 24/24, spec 32/32, `cf build`.
2. **Pages migrated.** Done with phase 1: every HTML entry is a route, links point at `/menu`.
3. **Cart, checkout, order page, staff screen** against the local test provider (`PAYMENTS=fake`). Done 23 Nov 2026: in the browser, added to the bag, chose a pick-up time and FPX, paid on `/pay/test/<id>`, the order appeared on `/staff` flagged as New with the count in the tab title, moved Accept → Mark ready, and the customer's page changed to Ready by itself. Also tried: a stale or edited bag, a double press on Pay (one order), Cancel payment (bag kept), Collected, Turn on sound (no errors; not heard), Sign out. Not tried: the 10-try PIN lockout. Fit 36/36 including `/checkout` and `/staff`. CHIP's signature check and request shape are unit-tested against a stub.
4. **CHIP, live.** Done 23 Nov 2026 on a live key, skipping test mode: a RM 9.00 FPX order moved to `paid` through a signed `purchase.paid` callback 38 s after it was placed. Not yet seen live: a card payment, a refund, an expiry. A refund made in CHIP's portal sends no callback; the staff board asks CHIP about each order on it at most once a minute and drops it once refunded.
5. **Kitchen.** Done with phase 3 (staff screen). Left: the client's real PIN and a tablet to try it on.
6. **PWA.** Manifest, icons, service worker, install prompt. Check: installs on Android and iOS, and the menu opens offline.
7. **StoreHub sales sync.** Built 23 Nov 2026 (`src/pos/`, dishes mapped in `src/site/pos.ts`, store Seksyen 4). Every 5 minutes the cron records sold orders as `CreditCard` Sales (real method and pick-up time in the comment) and cancels the Sales of refunded ones; `pos_recorded_at` / `pos_cancelled_at` mark what is done. Only `PAYMENTS=chip` writes to StoreHub, and staff test orders never do. The RM 9 launch test order (`991E3B`) was marked recorded by hand so it stays out. Not yet seen live: a real sale arriving in StoreHub's report, a cancel. Ask StoreHub whether custom payment options are accepted.
8. **Staff test order.** `/staff` → Test order (RM 1): a staff-only item, alone in its cart, allowed while orders are paused, never a POS sale. Not yet known: whether CHIP accepts RM 1.
9. **Pause and sold out.** `/staff` → Online ordering: pause for today or until resumed, and switch dishes sold out until the next shop day (`closures` table, `src/orders/availability.ts`). The menu shows Sold out and a paused banner; checkout refuses either on the server.
10. **Settling and alerts.** The same 5-minute cron asks CHIP about every order still awaiting payment: a payment whose callback was lost moves to paid, and an order past its window expires. Failures are emailed to `ALERT_TO` from `alerts@hazli.dev` (`src/ops/alert.server.ts`), each kind at most once per 6 hours: a callback that throws or names no order, money found without its callback, CHIP unreachable, a StoreHub record or cancel failing, a checkout error. Email needs Email Sending enabled on hazli.dev; until then alerts reach only the Worker's log.

## Running it locally

```bash
cp .dev.vars.example .dev.vars   # PAYMENTS=fake, a local staff PIN
pnpm db:migrate:local
pnpm dev                          # /menu → bag → /checkout → /pay/test → /order/<id>; kitchen at /staff
```

## Production

- Live at `https://cakejalantiung.app` (and `www.`), with `https://cakejalantiung.hazli-johar.workers.dev` still serving, deployed with `pnpm deploy` (`cf deploy`).
- Cloudflare account and D1 database are pinned in `cloudflare.config.ts` (`accountId`, the `DB` id): Hazli Johar's account, D1 `cakejalantiung` in APAC. Handing the site to the client means a new account id, a new D1 database with `migrations/` applied, and the secrets set again.
- Secrets on the Worker: `PAYMENTS=chip`, `CHIP_SECRET_KEY`, `CHIP_BRAND_ID`, `STAFF_PIN` (6+ digits), `SESSION_SECRET`, `STOREHUB_API_TOKEN`, `ALERT_TO`. Change one with `cf workers secrets update <NAME> --worker cakejalantiung`. A new `STAFF_PIN` signs every staff device out.
- A brand-new Worker cannot hold secrets before it exists, so its first deploy is `cf deploy --secrets-file <file>`; delete the file afterwards.

## Payment account

Launch takes payments into HAZLI JOHAR & CO's CHIP account until the shop opens its own. Switching is two secrets, no code: `cf workers secrets update CHIP_SECRET_KEY --worker cakejalantiung` and the same for `CHIP_BRAND_ID`, with the shop's live key and brand ID.

## Waiting on the client

- The shop's own CHIP account, to replace HAZLI JOHAR & CO's (see Payment account).
- The shop's own staff PIN, and which tablet the kitchen will use.
- Pick-up lead time: how many minutes from paying to ready.
