// A paid web order as a sale in the shop's StoreHub POS, so web sales land in the same sales
// report as the counter's. Shape from StoreHub's REST API document (v1.5, Add Transaction):
// amounts in ringgit, tax-exclusive, and one payment method for every web sale, so the real
// method and the pick-up time go in the comment.
import {orderCode, type PricedLine} from '../orders/model';
import {formatShopDateTime} from '../storefront/hours';

export type PosSale = {orderId: string; paidAt: string; pickupAt: string; paymentMethod: string; totalSen: number; items: readonly PricedLine[]};
export type PosShop = {storeId: string; paymentMethod: string; products: Readonly<Record<string, string>>; timeZone: string};

export type StorehubItem = {productId: string; quantity: number; unitPrice: number; subTotal: number; total: number; tax: number; discount: number};
export type StorehubTransaction = {
  refId: string;
  invoiceNumber: string;
  storeId: string;
  transactionType: 'Sale';
  transactionTime: string;
  paymentMethod: string;
  total: number;
  subTotal: number;
  tax: number;
  discount: number;
  roundedAmount: number;
  comment: string;
  items: StorehubItem[];
};

const ringgit = (sen: number) => sen / 100;

/** The Add Transaction body for a paid order. Throws when a dish has no StoreHub product, or the lines do not make the total. */
export function storehubTransaction(sale: PosSale, shop: PosShop): StorehubTransaction {
  const linesSen = sale.items.reduce((sum, line) => sum + line.unitSen * line.quantity, 0);
  if (sale.items.length === 0 || linesSen !== sale.totalSen) {
    throw new Error(`Order ${orderCode(sale.orderId)}: its ${sale.items.length} lines make ${linesSen} sen, not the ${sale.totalSen} sen paid`);
  }
  const products = new Map(Object.entries(shop.products));
  const items = sale.items.map((line): StorehubItem => {
    const productId = products.get(line.dishId);
    if (!productId) throw new Error(`No StoreHub product for dish "${line.dishId}"; add it to src/site/pos.ts`);
    const lineSen = line.unitSen * line.quantity;
    return {productId, quantity: line.quantity, unitPrice: ringgit(line.unitSen), subTotal: ringgit(lineSen), total: ringgit(lineSen), tax: 0, discount: 0};
  });
  const code = orderCode(sale.orderId);
  return {
    // The order id is a UUID, as StoreHub asks, and StoreHub ignores a second sale with the same refId.
    refId: sale.orderId,
    invoiceNumber: `WEB-${code}`,
    storeId: shop.storeId,
    transactionType: 'Sale',
    transactionTime: sale.paidAt,
    paymentMethod: shop.paymentMethod,
    total: ringgit(sale.totalSen),
    subTotal: ringgit(sale.totalSen),
    tax: 0,
    discount: 0,
    roundedAmount: 0,
    comment: `Web order ${code}, paid online (${sale.paymentMethod}), pick-up ${formatShopDateTime(shop.timeZone, sale.pickupAt)}`,
    items,
  };
}
