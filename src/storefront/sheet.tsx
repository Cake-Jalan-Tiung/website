// A dish up close: tap a dish anywhere on the storefront and it rises from the foot of the
// screen with its photo, its whole description, a quantity and one button that puts it in the
// bag. One sheet per page, opened by dish id, so every row and card can open it.
import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useRouter} from '@tanstack/react-router';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {bag, useBagQuantity} from '../orders/bag';
import {useAvailability} from '../orders/availability-store';
import {Label} from '../system/components';
import {Type} from '../system/Type';
import {dishIndex, type Dish, type Storefront} from './model';
import {Cta, formatPrice, Stepper} from './bag';
import {photoFor} from './photos';
import {PAUSED} from './promise';
import s from './storefront.module.css';

/** The open dish and which opening this is, so every opening starts from the bag as it stands. */
let open: {id: string | null; seq: number} = {id: null, seq: 0};
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const setOpen = (id: string | null) => {
  open = {id, seq: id === null ? open.seq : open.seq + 1};
  listeners.forEach((listener) => listener());
};

export const openDish = (id: string) => setOpen(id);

/** The dish's name as the button that opens it; its hit area covers its whole card, row or cell. */
export function OpenDish({dish}: {dish: Dish}) {
  return (
    <button type="button" className={s.open} aria-haspopup="dialog" onClick={() => openDish(dish.id)}>
      {dish.name}
    </button>
  );
}

/** The sheet, once per page. It shows nothing until a dish is opened. */
export function DishSheet({store}: {store: Storefront}) {
  const {id, seq} = useSyncExternalStore(subscribe, () => open, () => open);
  // The open dish is shared by every page; leaving one, by a link or Back, closes it before the next renders.
  const router = useRouter();
  useEffect(() => router.subscribe('onBeforeNavigate', () => open.id !== null && setOpen(null)), [router]);
  // The last dish stays rendered while the sheet slides away.
  const shown = useRef<Dish | null>(null);
  const dish = id ? (dishIndex(store).get(id) ?? null) : null;
  if (dish) shown.current = dish;
  return (
    <BottomSheet isOpen={dish !== null} onOpenChange={(open) => !open && setOpen(null)} label={shown.current?.name ?? 'Dish'} height="hug" padding={0}>
      {shown.current ? <DishDetail key={seq} dish={shown.current} store={store} /> : null}
    </BottomSheet>
  );
}

function DishDetail({dish, store}: {dish: Dish; store: Storefront}) {
  const inBag = useBagQuantity(dish.id);
  const {ordersPaused, soldOut} = useAvailability();
  // The quantity is the customer's choice until they confirm it; it starts from the bag.
  const [quantity, setQuantity] = useState(() => Math.max(1, inBag));
  const photo = photoFor(dish.id);
  const closed = soldOut[dish.id];
  const unavailable = closed ? (closed.until ? 'Sold out today' : 'Sold out') : ordersPaused ? PAUSED : null;
  const removing = inBag > 0 && quantity === 0;
  const confirm = () => {
    bag.set(dish.id, quantity);
    setOpen(null);
  };
  const total = formatPrice((Math.round(dish.price * 100) * quantity) / 100);

  return (
    <article className={s.sheet}>
      {photo ? <img src={photo.src} srcSet={photo.srcSet} sizes="100vw" alt="" className={s.sheetPhoto} decoding="async" /> : null}
      <div className={s.sheetBody}>
        {store.bestSellers.includes(dish.id) ? <Label>Best seller</Label> : null}
        <Type role="subhead" as="h2" className={s.sheetName}>
          {dish.name}
        </Type>
        <Type role="body" className={s.sheetPrice}>
          {formatPrice(dish.price)}
        </Type>
        {dish.description ? (
          <Type role="body" as="p" ink="secondary">
            {dish.description}
          </Type>
        ) : null}
      </div>
      <div className={s.sheetFoot}>
        {unavailable ? (
          <>
            <Type role="body" className={s.sheetNote}>{unavailable}</Type>
            {/* Already in the bag: it can still be taken out, so checkout is not left to refuse it. */}
            {inBag > 0 ? (
              <Cta
                onClick={() => {
                  bag.set(dish.id, 0);
                  setOpen(null);
                }}
              >
                Remove from bag
              </Cta>
            ) : null}
          </>
        ) : (
          <>
            <Stepper name={dish.name} quantity={quantity} onChange={setQuantity} min={inBag > 0 ? 0 : 1} staged />
            {removing ? (
              <Cta onClick={confirm}>Remove from bag</Cta>
            ) : (
              <Cta onClick={confirm} value={total}>
                {inBag > 0 ? 'Update' : 'Add'}
              </Cta>
            )}
          </>
        )}
      </div>
    </article>
  );
}
