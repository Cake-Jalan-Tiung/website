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
- **StoreHub has no order write API.** Its API is read-only (products, customers, transactions, inventory, employees, stores, timesheets), on Advanced/Pro plans, credentials from Customer Care. Sources: StoreHub Care article on API access, and an unofficial reverse-engineered client. Pushing our orders into the POS is not possible without StoreHub building it.

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
4. **CHIP test mode.** Needs the client's test key and `brand_id`. Check: a test card purchase moves an order to `paid` through a signed callback.
5. **Kitchen.** Done with phase 3 (staff screen). Left: the client's real PIN and a tablet to try it on.
6. **PWA.** Manifest, icons, service worker, install prompt. Check: installs on Android and iOS, and the menu opens offline.

## Running it locally

```bash
cp .dev.vars.example .dev.vars   # PAYMENTS=fake, a local staff PIN
pnpm db:migrate:local
pnpm dev                          # /menu → bag → /checkout → /pay/test → /order/<id>; kitchen at /staff
```

## Before the first deploy

- `cf d1 create cakejalantiung`, put its id in `cloudflare.config.ts`, apply `migrations/` remotely.
- Set `PAYMENTS=chip`, `CHIP_SECRET_KEY`, `CHIP_BRAND_ID`, `STAFF_PIN` (6+ digits), `SESSION_SECRET` as secrets.
- Run one CHIP test-mode purchase end to end, including the callback, on a public URL (CHIP rejects callback URLs with a port).

## Waiting on the client

- CHIP test secret key and `brand_id` (phase 4).
- The staff PIN, and which tablet the kitchen will use.
- Pick-up lead time: how many minutes from paying to ready.
