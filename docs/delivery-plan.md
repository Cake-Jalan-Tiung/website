# Delivery

Goal: customers order delivery on the shop's own site, so the shop can leave Beep. Delivery is as easy as Domino's: the address fills from the phone's location or a search, a pin confirms it, the fee is known before paying, and the order page follows the rider to the door.

## Decisions

- **Courier: Lalamove API v3** (`rest.lalamove.com`, sandbox `rest.sandbox.lalamove.com`). It prices each address, books the rider and tracks the ride. The shop needs a Lalamove Business account with a topped-up wallet. Delivery runs as a stand-in courier locally (`DELIVERY=fake`), the same way payments do: `/deliver/test/<order>` stands in for the rider.
- **Maps: Google Maps JavaScript API** in the browser: Places (New) autocomplete for typed addresses, the Geocoder for "Use my location", and a map whose centre is the pin. One browser key restricted to the shop's domains. Results are shown on a Google map, which carries the attribution the terms ask for.
- **The kitchen does not change.** Every order still has `pickup_at`, the time it must be at the counter. For a delivery that is when the rider collects it, so the board, the lead time and the slots stay as they are. The customer sees an arrival estimate: that time plus the ride.
- **Who pays.** The customer pays Lalamove's quote as the delivery fee. The quote comes back with a token signed by the server (fee, distance, the exact point, an hour's life), and placing the order charges the fee in the token, so the amount on Pay is the amount charged and a Lalamove outage while paying blocks nothing. If Lalamove's price has moved by the time the rider is booked, the shop absorbs the difference (recorded per order as `cost_sen`, alerted when above the fee).
- **When the rider is booked.** Not at payment: a scheduled Lalamove order can only be cancelled while no driver has matched, so booking hours ahead would leave refunds stuck with a rider. The 5-minute job books each paid delivery 30 minutes before its collection time, scheduled for that time (at once when that time is under 30 minutes away). Staff can book early with one tap when the order is ready sooner.
- **No rider.** If Lalamove reports `EXPIRED`, `REJECTED` or `CANCELED` (not by us), the job books again, up to 3 times, then alerts staff and marks the ticket to call the customer.
- **Refunds.** Refunding a delivery cancels its Lalamove booking when Lalamove still allows it; otherwise staff are alerted.
- **Truth comes from Lalamove.** A webhook (signed with the API secret) only says which delivery changed; the server then reads that delivery from Lalamove's API. The 5-minute job also reads every delivery in flight, so a lost webhook only delays an update. The webhook always answers 200, as Lalamove turns off a URL after ten failures.
- **Checkout.** Pick-up or Delivery, then Use my location or a search (Google Places), a map whose centre is the pin, "House, unit or floor" (required) and a note for the rider. Deliver here prices the ride once; moving the pin only looks up the street. The fee joins the bag above the total, times read as arrivals ("Arrives about 3:05pm"), and the address is remembered for 30 days.
- **After paying.** The order page shows Paid, Preparing, On the way, Delivered, the arrival estimate, the rider's first name and Lalamove's live map. There is no I'm here. The customer gets the receipt (with the fee and the address) and an "on the way" email; never the "ready to collect" one.
- **Kitchen.** Delivery tickets carry a black Delivery band with the distance, the full address and rider note, the rider's state, name, plate and phone, and Book rider now. Ready's action reads Handed to rider. Delivery can be paused apart from pick-up.
- **POS.** StoreHub records the food only, at what the customer paid for it. The delivery fee goes to Lalamove and is named in the sale's comment.
- **Pause.** Staff can pause delivery on its own (a `delivery` closure, like pausing online orders). Pick-up keeps working.

## Model

```
deliveries   order_id (PK → orders), address, unit, instructions, lat, lng, distance_m, fee_sen,
             state, attempts, courier_order_id, share_link, driver_name, driver_phone, driver_plate,
             cost_sen, booked_at, updated_at
```

`orders.total_sen` is what was charged: food plus `fee_sen`. An order is a delivery when it has a row here.

Delivery states: `waiting` (paid, rider not yet booked) → `booking` (claimed; a claim older than 2 minutes lapses) → `finding_rider` → `rider_assigned` → `on_the_way` → `delivered`. `failed` waits for the job to book again; `stuck` needs staff (booking refused, or 3 tries without a rider); `cancelled` after a refund. Lalamove `PICKED_UP` also moves the order from ready to collected, so the kitchen board clears.

## Configuration

- `DELIVERY` (text, `cloudflare.config.ts`): `fake` in `vite dev`, empty in a build, so production takes pick-up orders only and keeps its Beep link until this is set to `lalamove`.
- `LALAMOVE_API_KEY`, `LALAMOVE_API_SECRET` (secrets). The key's prefix (`pk_test` or `pk_prod`) picks sandbox or production. Not declared yet: a declared secret that is not set fails `cf deploy`, so they are declared in the same change that turns delivery on.
- `GOOGLE_MAPS_KEY` (text): the browser key. Public by design; restrict it to `cakejalantiung.app`, `www.cakejalantiung.app` and the workers.dev host.
- `deliveryArea` in `content.ts`: the shop's pin (`from`), radius (10 km), Lalamove service (`MOTORCYCLE`), and the ride estimate (10 minutes to collect plus 3 a kilometre). All but the pin are assumptions until the shop decides.

## Checked

Against the stand-in courier and stand-in address list only, not against Lalamove or Google:

- `pnpm walk` (Chromium and WebKit) adds a delivery leg: an address 40 km away is refused before paying, a 6 km one is priced into the bag and Pay, payment, the order page (no I'm here), Book rider now on `/staff`, then the stand-in ride to Rider on the way, On the way and Delivered. No spills at 390 and 320, no console errors.
- Unit tests: `src/delivery/delivery.test.ts` (area, drop-off parsing, state moves, the quote token, Lalamove's request signing, booking body, error kinds and webhook signature) and `src/delivery/dispatch.test.ts` (booking window, one booking however many ask, refusals to staff, retries, picked up clearing the board, three tries then staff, refund cancellations). Email, receipt PDF and StoreHub tests cover the delivery fee and address.
- The deliveries SQL (booking claims, lapsed claims to staff, three tries, shop scoping, refunds, StoreHub's food-only total, no I'm here) was run once against SQLite with every migration applied; a one-off check, not kept as a test.
- In the browser: No rider on the test page (the customer reads that another rider is being booked; the ticket offers Book rider now, which books again), and Pause delivery on `/staff` (checkout offers pick-up only and says why; Resume brings Delivery back).
- Not yet seen: a real Lalamove quote, booking, driver or webhook; Google's search, location and map; the 5-minute job's delivery step (the dev server has no cron); a rider booked at payment, which happens only in opening hours (walk it once then).

## Known limits

- `quoteDelivery` is open to anyone, like the rest of checkout, and is not throttled: a flood of quotes could use up Lalamove's 100 quotations a minute and leave real customers unable to price delivery. Add a per-address cache or a rate limit if that is ever seen.
- A booking whose answer never came back goes to staff rather than being made again, so a timed-out call costs a person a look at the Partner Portal, never a second rider.

## Going live

1. Apply `migrations/0009_deliveries.sql` to the production D1 before the first deploy of this code: `pnpm exec cf d1 migrations apply 9f1ccf1f-02eb-47eb-be65-c20274559efe`. With `DELIVERY` empty the site behaves as before.
2. With the sandbox key: `LALAMOVE_API_KEY=… LALAMOVE_API_SECRET=… node scripts/lalamove-check.mjs <lat,lng>` lists the services Malaysia offers and prices a sample ride; set `deliveryArea.service` from it.
3. Set the secrets: `cf workers secrets update LALAMOVE_API_KEY --worker cakejalantiung`, and the same for `LALAMOVE_API_SECRET`.
4. In one change: declare both as `bindings.secret()`, set `DELIVERY` to `lalamove`, set `GOOGLE_MAPS_KEY`, and put the shop's pin in `deliveryArea.from`.
5. In Lalamove's Partner Portal (Developers, Webhook, Version 3), set the webhook to `https://cakejalantiung.app/api/delivery/callback`.
6. One sandbox order end to end, then the production key and the same order for real.

## Waiting on the client

- Lalamove Business account and API keys, sandbox first.
- Google Maps Platform key with Maps JavaScript API, Places API (New) and Geocoding API enabled.
- The shop's exact pin (the point on Google Maps where riders should stop). Until then `deliveryArea.from` is null and live delivery refuses to start; the stand-in uses the centre of Seksyen 4 from OpenStreetMap, which is not the shop's door.
- Google lets the browser keep a place's coordinates for 30 days; the remembered address follows that.
- Delivery radius, and whether to add anything to Lalamove's fee.
