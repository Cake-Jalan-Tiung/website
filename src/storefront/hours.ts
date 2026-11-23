// Wall-clock times as the shop writes them ("08:30"), and the shop's own clock. Opening hours,
// "today" and pick-up times are read in the shop's time zone, never the server's (Workers run in UTC).

/** A time of day, 24-hour, as "HH:MM". */
export type ClockTime = `${number}:${number}`;
/** From and to, the second exclusive. */
export type Span = readonly [ClockTime, ClockTime];
/** A calendar day on the shop's clock. */
export type ShopDate = {year: number; month: number; day: number};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const toMinutes = (time: ClockTime) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** 480 → "8am", 510 → "8:30am", 720 → "12pm". */
export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}${hours < 12 ? 'am' : 'pm'}`;
}

export const formatSpan = ([from, to]: Span) => `${formatMinutes(toMinutes(from))} – ${formatMinutes(toMinutes(to))}`;

// Building a formatter is the expensive part of reading a clock; keep one per time zone.
const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

/** The shop's wall clock at `now`: Monday-first day index, calendar date, and minutes since midnight. */
export function shopClock(timeZone: string, now: Date = new Date()) {
  const parts = formatterFor(timeZone).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    dayIndex: WEEKDAYS.findIndex((day) => day === part('weekday')),
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

/** The instant at which the shop's clock reads `minutes` past midnight on the given calendar date. */
export function shopInstant(timeZone: string, date: ShopDate, minutes: number) {
  const guess = Date.UTC(date.year, date.month - 1, date.day, 0, minutes);
  const seen = shopClock(timeZone, new Date(guess));
  const seenAt = Date.UTC(seen.year, seen.month - 1, seen.day, 0, seen.minutes);
  return new Date(guess - (seenAt - guess));
}

export const startOfShopDay = (timeZone: string, now: Date = new Date()) => shopInstant(timeZone, shopClock(timeZone, now), 0);

/** The calendar day `offset` days after `date`. */
export function addDays(date: ShopDate, offset: number): ShopDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + offset));
  return {year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate()};
}

export const dateKey = (date: ShopDate) => `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;

/** "Today", "Tomorrow", or "Fri 27 Nov", relative to the shop's today. */
export function dayLabel(timeZone: string, date: ShopDate, now: Date = new Date()) {
  const today = shopClock(timeZone, now);
  const key = dateKey(date);
  if (key === dateKey(today)) return 'Today';
  if (key === dateKey(addDays(today, 1))) return 'Tomorrow';
  const weekday = (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
  return `${WEEKDAYS[weekday]} ${date.day} ${MONTHS[date.month - 1]}`;
}

/** A moment on the shop's clock: "Today, 2:15pm", "Fri 27 Nov, 2:15pm". */
export function formatShopTime(timeZone: string, iso: string, now: Date = new Date()) {
  const at = shopClock(timeZone, new Date(iso));
  return `${dayLabel(timeZone, at, now)}, ${formatMinutes(at.minutes)}`;
}
