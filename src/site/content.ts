// Brand copy. Every string comes from the Paper file (Concept, Grammar, Mock up),
// except the address and hours, which the owner supplied. Grammar sheet 15: Malay first, English second.
import type {Bilingual, MenuItem} from '../system/components';
import type {Flavour} from '../system/model';

export type {Bilingual, MenuItem};

// Grammar sheet 15 vocabulary. The list is provisional until sheets 10 to 16 can be exported.
export const labels = {
  today: {bm: 'Hari ini', en: 'Today'},
  freshFromOven: {bm: 'Baru keluar oven', en: 'Fresh from the oven'},
  inSeason: {bm: 'Musim ini', en: 'In season'},
  open: {bm: 'Buka', en: 'Open'},
  orderNow: {bm: 'Tempah sekarang', en: 'Order now'},
  order: {bm: 'Pesanan', en: 'Order'},
} satisfies Record<string, Bilingual>;

// "When it's gone, it's gone." Grammar sheet 15: never translated.
export const soldOutLine = 'Habis bila habis';

// The promise breaks after "world", as on the Concept statement.
export const promise = 'Baking the world\na little sweeter.';
export const handDrawn = 'Every little mark here was drawn by hand — with a lot of love, and a little flour.';
export const signOff = 'With love, from our kitchen';
// The menu board's header names the shop by its street, as on Mock up 03.
export const boardPlace = 'Jalan Tiung';

export const address = {
  name: 'Cake Jalan Tiung',
  lines: ['9, Jln Sukun 4/7', 'Seksyen 4', '40000 Shah Alam', 'Selangor'],
} as const;

// Opening days were not given, so none are shown.
export const hours = {opens: 8, closes: 6, written: '8am – 6pm', spoken: '8am to 6pm'} as const;

export const menu: readonly MenuItem[] = [
  {bm: 'Roti Garam', en: 'Shio pan · salt roll, buttery centre', price: 8},
  {bm: 'Kek Pandan Kaya', en: 'Pandan kaya cake, coconut jam', price: 12},
  {bm: 'Kek Gula Melaka', en: 'Palm sugar cake, caramel edge', price: 14},
  {bm: 'Kroisan', en: 'Croissant · twenty-seven layers', price: 9},
  {bm: 'Kopi O Panas', en: 'Black coffee, hot', price: 6},
  {bm: 'Teh Tarik', en: 'Pulled tea, condensed milk', price: 7},
];

export const inSeason: {flavour: Flavour; item: MenuItem} = {flavour: 'pandan', item: menu[1]};
