// Pick-up times: every slot the shop can honour, read on the shop's own clock.
import type {Storefront} from '../storefront/model';
import {addDays, dateKey, dayLabel, formatMinutes, shopClock, shopInstant, toMinutes, type Span} from '../storefront/hours';

/** `date` groups slots by day; `day` and `time` are what the customer reads. */
export type Slot = {at: string; date: string; day: string; time: string};

/** Open slots from now, `leadMinutes` out, inside opening hours and the cart's serving window. */
export function pickupSlots(store: Storefront, now: Date, window?: Span): Slot[] {
  const {leadMinutes, slotMinutes, daysAhead} = store.pickup;
  const earliest = now.getTime() + leadMinutes * 60_000;
  const today = shopClock(store.timeZone, now);
  const slots: Slot[] = [];
  for (let offset = 0; offset <= daysAhead; offset++) {
    const date = addDays(today, offset);
    const open = store.week[(today.dayIndex + offset) % 7]?.open;
    if (!open) continue;
    const from = Math.max(toMinutes(open[0]), window ? toMinutes(window[0]) : 0);
    const to = Math.min(toMinutes(open[1]), window ? toMinutes(window[1]) : 24 * 60);
    const day = dayLabel(store.timeZone, date, now);
    // One clock read per day; a zone that changes its clock mid-day would need one per slot.
    const midnight = shopInstant(store.timeZone, date, 0).getTime();
    for (let minutes = from; minutes <= to - slotMinutes; minutes += slotMinutes) {
      const at = midnight + minutes * 60_000;
      if (at >= earliest) slots.push({at: new Date(at).toISOString(), date: dateKey(date), day, time: formatMinutes(minutes)});
    }
  }
  return slots;
}

/** Whether `at` is still one of the offered slots; the server checks this again when the order is placed. */
export const isOpenSlot = (store: Storefront, now: Date, at: string, window?: Span) =>
  pickupSlots(store, now, window).some((slot) => slot.at === at);
