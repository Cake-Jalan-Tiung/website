// Where this shop's web sales are recorded: its StoreHub account, the store customers collect
// from, and the StoreHub product behind each dish on the site. Read from StoreHub's API on
// 23 November 2026. A dish added to the menu needs its product here; a test holds them together.
export const storehub = {
  /** The account's back-office subdomain, which StoreHub uses as the API username. */
  username: 'cakejalantiung',
  /** Cake Jalan Tiung | Seksyen 4 Shah Alam, the pick-up counter. */
  storeId: '560ce27f0ce34105ab775d52',
  /**
   * The payment method web sales are recorded under. StoreHub's API takes only its built-in names:
   * tried 24 Nov 2026 with a custom option "CJT-webapp" added in the back office, it answered 409
   * "paymentMethod 'CJT-webapp' is invalid", and a `payments` list in its place answered
   * "paymentMethod is required field". Custom options appear on the counter's own sales but cannot
   * be written through the API. Web sales are told apart by their WEB- invoice number and comment.
   */
  paymentMethod: 'CreditCard',
  products: {
    'indulgent-iceberg-cheesecake': '697f09181a52e000070f25fb',
    'london-to-shah-alam': '6a8115df50c22800078fc78d',
    'salted-caramel-choc': '55aca8a42ea4108c993c77e5',
    'raspberry-vanilla': '68a00af3462ad80007befc20',
    'matcha-strawberry': '62da4d911bda0f00081016f1',
    'iced-ajisai-matcha-latte': '683fe999d7c0ce00083fcfe5',
    'bakers-spanish-latte': '6717480000354b00082f9376',
    'iced-caramel-latte': '5f6ada978c11b40006f5a809', // Caramel Latte - Ice
    'iced-cafe-latte': '55acb2f240474a96d32434cc', // Latte / Capp / FW - Ice
    latte: '559ccf07af3da5328e096025', // Latte; the site sells latte, cappuccino and flat white as one dish
    'iced-long-black': '55acb2ac13d5f21cd346b35e', // Long Black - Ice
    'long-black': '55acb2d340474a96d32434c7',
    'strawberry-cream-cheese-danish': '600f782737aa480006c62eb5',
    'peach-danish': '6209b5b22059e80006f76263',
    'egg-tart': '6879f6bc17ed8a00074ba52c',
    'shio-pan': '691fe5a640167700077e1216',
    croissant: '602b358b83bf530006d0e546',
    'dubai-chewy-cookie': '69d47f396d704800072608de',
    'butter-tteok': '69d607671d72fd0007f5d7d3',
    '4cs-cookies': '55acbabc05d7d7acf0554fc5',
    'chunky-smores-cookie': '686b39b591c5860007e73e9b',
    'brown-butter-chocolate-cookie': '69fa9d04e5a71a0007b92007',
    'classic-big-breakfast': '63c4942396fe4f0009cc11b6',
    'spicy-dendeng-sourdough': '64504fd043dcb8000aedcd63',
    'streaky-beef-truffle-pasta': '68eddfb17c0e420007096bbe',
    'aglio-olio-prawns': '65bc45bd2cc1ab00082082a7',
    'chicken-tomato-basil': '65d5971d53ec7e0007617502',
    'chicken-carbonara': '65bc453ee4319900075a87ba',
  } satisfies Record<string, string>,
};
