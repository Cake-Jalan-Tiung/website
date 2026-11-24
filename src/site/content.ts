// Brand copy. Every string comes from the Paper file (Concept, Grammar, Mock up),
// except the address and hours, which the owner supplied, and the storefront block at the end. Grammar sheet 15: Malay first, English second.
import type {Bilingual, MenuItem} from '../system/components';
import type {Flavour} from '../system/model';
import type {Storefront} from '../storefront/model';
import {BurungTiung, ButterTteok, Coffee, Croissant, CrownedTiung, ShioPan, TiungCat} from '../marks/marks.generated';

export type {Bilingual, MenuItem};

// Grammar sheet 15 vocabulary. The list is provisional until sheets 10 to 16 can be exported.
export const labels = {
  today: {bm: 'Hari ini', en: 'Today'},
  freshFromOven: {bm: 'Baru keluar oven', en: 'Fresh from the oven'},
  inSeason: {bm: 'Musim ini', en: 'In season'},
  open: {bm: 'Buka', en: 'Open'},
  orderNow: {bm: 'Tempah sekarang', en: 'Order now'},
  order: {bm: 'Pesanan', en: 'Order'},
  // Not from Paper: Jumlah is the Malay for a sum, set before the English as sheet 15 orders every pair.
  total: {bm: 'Jumlah', en: 'Total'},
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

// The Paper pieces' hours. Days are in the storefront below (closed on Thursdays, per Google).
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

// ---------- Storefront ----------
// Not from Paper: the storefront is in English at the owner's request, so it does not use the
// Malay-first vocabulary in `labels` or the untranslatable "Habis bila habis".

// Pick-up orders are placed and paid on this site. Delivery stays on the shop's Beep store
// until the site delivers; Beep cannot link to a single item, so that link opens the store.
const beep = 'https://cakejalantiung.beepit.com/ordering/';

// The Google Maps listing "Cake Jalan Tiung Seksyen 4", read on 23 November 2026:
// hours, phone, rating and review count.
const googleListing = 'https://maps.google.com/?cid=3539512419364173597';


// The menu as the Beep store listed it on 23 November 2026: names, descriptions and prices
// copied from it, sections in its order. Beep's "Replace with Oat Milk" is an add-on, not a dish,
// and is left out. Big Brown Butter Chocolate Cookie shows 12.00 with a struck 9.50 on Beep;
// 12.00 is the price it charges.
export const storefront: Storefront = {
  name: address.name,
  // The registered company, as the owner gave it on 24 November 2026. No registration number yet.
  legalName: 'CJT Bakery Sdn. Bhd.',
  address: address.lines,
  phone: {display: '012-878 7258', href: 'tel:+60128787258'},
  week: [
    {day: 'Monday', open: ['08:00', '18:00']},
    {day: 'Tuesday', open: ['08:00', '18:00']},
    {day: 'Wednesday', open: ['08:00', '18:00']},
    {day: 'Thursday', open: null},
    {day: 'Friday', open: ['08:00', '18:00']},
    {day: 'Saturday', open: ['08:00', '18:00']},
    {day: 'Sunday', open: ['08:00', '18:00']},
  ],
  hoursLine: 'Open 8am – 6pm · Closed Thursdays',
  signOff,
  nav: [
    {label: 'Menu', href: '/menu'},
    {label: 'Best sellers', href: '/#best-sellers'},
    {label: 'Visit', href: '/#visit'},
  ],
  delivery: {label: 'Delivery on Beep', href: `${beep}?type=delivery`},
  menu: {label: 'See the menu', href: '/menu'},
  facts: [
    {title: 'Order ahead', line: 'Pay online, collect at the counter.'},
    {title: 'Open six days', line: '8am to 6pm. Closed on Thursdays.'},
    {title: 'Breakfast till noon', line: 'Served 8:30am to 12pm.'},
    {title: 'Section 4, Shah Alam', line: '9, Jln Sukun 4/7.'},
  ],
  proof: {rating: 4.2, reviews: 704, source: 'Google', asOf: 'November 2026', href: googleListing},
  categories: [
    {
      id: 'cakes',
      name: 'Cake slices',
      cover: 'indulgent-iceberg-cheesecake',
      tile: {engine: 'alive', ground: 'cream-400', mark: CrownedTiung},
      dishes: [
        {id: 'indulgent-iceberg-cheesecake', name: 'Indulgent Iceberg Cheesecake', price: 28, description: 'Indulgent and creamy Basque-style burnt cheesecake base topped with a thick, velvety layer of chocolate ganache. Served chilled, offering a contrast between the rich cream cheese and dark chocolate.'},
        {id: 'london-to-shah-alam', name: 'London to Shah Alam - Cake Slice', price: 26, description: 'A delicious combination of moist chocolate cake frosted with rich chocolate ganache and whipped salted caramel creates the perfect balance of sweet, salty and intense chocolate flavour.'},
        {id: 'salted-caramel-choc', name: 'Salted Caramel & Choc - Slice', price: 20, description: 'Chocolate cake, buttercream frosting and drizzle of salted caramel magic.'},
        {id: 'raspberry-vanilla', name: 'Raspberry & Vanilla - Slice', price: 20.5, description: 'Delicate layers of vanilla cake and raspberry compote and buttercream combine for a delicious combination. Topped with freeze dried raspberries for lovely crunch texture on top.'},
      ],
    },
    {
      id: 'drinks',
      name: 'Drinks',
      cover: 'iced-ajisai-matcha-latte',
      tile: {engine: 'edible', ground: 'cream-100', mark: Coffee},
      dishes: [
        {id: 'matcha-strawberry', name: 'Shaf’s Favourite Matcha & Strawberry', price: 18.5, description: 'Iced matcha combined with milk and strawberry & raspberry compote'},
        {id: 'iced-ajisai-matcha-latte', name: 'Iced Ajisai 2.0 Matcha Latte', price: 19.5, description: 'Iced matcha latte made with NIKO NEKO Ajisai 2.0 ceremonial-grade matcha. Tasting notes of balanced nuttiness and medium creaminess.'},
        {id: 'bakers-spanish-latte', name: 'Baker’s Spanish Latte', price: 17, description: 'Delicious sweet cream on top, double shot of espresso, milk & sprinkling of cocoa'},
        {id: 'iced-caramel-latte', name: 'Iced Caramel Latte', price: 14.5},
        {id: 'iced-cafe-latte', name: 'Iced Cafe Latte', price: 14},
        {id: 'latte', name: 'Latte / Cappuccino / Flat White', price: 12.5, description: 'Double shot of espresso and topped with steamed milk. Beans currently using: Blend of Tanzania + Brazil', drawing: {engine: 'edible', ground: 'cream-100', mark: Coffee}},
        {id: 'iced-long-black', name: 'Iced Long Black', price: 12},
        {id: 'long-black', name: 'Long Black', price: 11, description: 'Double shot of espresso and hot water for a relaxing coffee to enjoy. Beans currently using: Blend of Tanania & Brazil.', drawing: {engine: 'edible', ground: 'cream-100', mark: Coffee}},
      ],
    },
    {
      id: 'pastries',
      name: 'Pastries',
      cover: 'croissant',
      tile: {engine: 'edible', ground: 'paper', mark: Croissant},
      dishes: [
        {id: 'strawberry-cream-cheese-danish', name: 'Strawberry Cream Cheese Danish', price: 14, description: 'Handcrafted pastry with cream cheese and strawberries.'},
        {id: 'peach-danish', name: 'Peach Danish', price: 14, description: 'Pastry with cream cheese filling and topped with delectable sweet peach slices.'},
        {id: 'egg-tart', name: 'Shafinaz-style Egg Tart', price: 11, description: 'Our version of Portuguese egg tart, made with flaky pasty shell and creamy delicious egg custard in the middle.'},
        {id: 'shio-pan', name: 'Shio Pan Salt Bread', price: 12, description: 'Soft, buttery Japanese bread roll with a crispy, salty bottom. It’s made by baking a piece of butter into a crescent-shaped, enriched dough, which melts and fries the bottom of the roll to create a signature crispiness. The interior remains soft and fluffy. Reheat instructions: Use a toaster oven or airfryer and reheat for 3mins at 180c.', drawing: {engine: 'edible', ground: 'cream-100', mark: ShioPan}},
        {id: 'croissant', name: 'Croissant', price: 9, description: 'Freshly baked croissant by our bakers made with premium French butter.', drawing: {engine: 'edible', ground: 'cream-100', mark: Croissant}},
      ],
    },
    {
      id: 'small-bites',
      name: 'Small bites',
      cover: 'dubai-chewy-cookie',
      tile: {engine: 'edible', ground: 'cream-100', mark: ButterTteok},
      dishes: [
        {id: 'dubai-chewy-cookie', name: 'Dubai Chewy Cookie', price: 16.5, description: 'Our Dubai Chewy Cookies are irresistibly soft on the inside and loaded with rich, premium ingredients that melt in your mouth. Inspired by the bold and indulgent flavors of Dubai, each cookie is crafted to satisfy your sweetest cravings.'},
        {id: 'butter-tteok', name: 'Butter Tteok', price: 16.5, description: 'Enjoy this South Korean viral, modern baked dessert that combines a deeply crispy, caramelised outer crust with a soft, bouncy, and chewy mochi-like centre. One set is 3 pieces of butter tteok and small amount of condensed milk for dipping.', drawing: {engine: 'edible', ground: 'cream-100', mark: ButterTteok}},
        {id: '4cs-cookies', name: '4C’s Cookies - 5pcs', price: 13, description: '5pcs of 4C’s Cookies (CJT chocolate chip cookies) in a small box.'},
        {id: 'chunky-smores-cookie', name: 'Chunky S’mores Cookie', price: 12, description: 'Chunky soft cookie made with a combination of delicious marshmallows, chocolate chip and crumble.'},
        {id: 'brown-butter-chocolate-cookie', name: 'Big Brown Butter Chocolate Cookie', price: 12, description: 'Big-sized cookie made with browned butter, high quality chocolate and sea salt flakes.'},
      ],
    },
    {
      id: 'breakfast',
      name: 'Breakfast',
      cover: 'classic-big-breakfast',
      servedBetween: ['08:30', '12:00'],
      tile: {engine: 'alive', ground: 'chalk', mark: BurungTiung},
      dishes: [
        {id: 'classic-big-breakfast', name: 'Classic Big Breakfast', price: 34, description: 'Sourdough bread, grilled potatoes, artisanal beef sausage, scrambled eggs, cherry tomatoes and salads'},
        {id: 'spicy-dendeng-sourdough', name: 'Spicy Dendeng on Sourdough', price: 25, description: 'Sourdough topped with homemade beef dendeng & scrambled egg with salad.'},
      ],
    },
    {
      id: 'mains',
      name: 'Mains',
      cover: 'streaky-beef-truffle-pasta',
      tile: {engine: 'alive', ground: 'cream-400', mark: TiungCat},
      dishes: [
        {id: 'streaky-beef-truffle-pasta', name: 'Streaky Beef & Truffle Pasta', price: 34.5, description: 'Cream sauce pasta with fragrant truffle paste and streaky beef strips for a delicious meal.'},
        {id: 'aglio-olio-prawns', name: 'Aglio Olio & Tiger Prawns Pasta', price: 33.5, description: 'Pasta with aglio olio sauce and grilled tiger prawns.'},
        {id: 'chicken-tomato-basil', name: 'Grilled Chicken, Tomato & Basil Pasta', price: 29.5, description: 'Grilled chicken breast, ripe cherry tomato sauce, extra virgin olive oil & garlic'},
        {id: 'chicken-carbonara', name: 'Grilled Chicken Carbonara Pasta', price: 28.5, description: 'Pasta with creamy carbonara sauce topped with grilled chicken fillets and shitake mushrooms.'},
      ],
    },
  ],
  // Until the shop's own photos arrive, every photo is Beep's (src/assets/photos), and the
  // hero and category tiles borrow a dish's.
  heroCover: 'london-to-shah-alam',
  // Inside the drawn shopfront: the dishes that have their own drawing, bakes first, then coffee.
  counter: {dishes: ['shio-pan', 'croissant', 'butter-tteok', 'latte', 'long-black']},
  // Beep's own Best Seller list, in its order.
  bestSellers: ['london-to-shah-alam', 'shio-pan', 'dubai-chewy-cookie', 'butter-tteok'],
  // What checkout offers beside a bag, one dish from each it lacks: a drink, a bake, a slice.
  addOns: ['drinks', 'pastries', 'small-bites', 'cakes'],
  mapHref: googleListing,
  timeZone: 'Asia/Kuala_Lumpur',
  // Assumed until the shop confirms how long an order takes to be ready.
  pickup: {leadMinutes: 20, slotMinutes: 15, daysAhead: 2},
};
