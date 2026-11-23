// Counts and lists in the customer's words, built by the platform instead of by hand.
const plurals = new Intl.PluralRules('en');
const lists = new Intl.ListFormat('en', {style: 'long', type: 'conjunction'});

/** 1 item, 3 items. */
export const count = (n: number, one: string, other: string) => `${n} ${plurals.select(n) === 'one' ? one : other}`;

/** A, A and B, A, B and C. */
export const list = (items: readonly string[]) => lists.format(items);
