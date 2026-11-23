// The bag's controls: one-tap Add on every dish, a stepper once it is in the bag, the header
// button, and the bar pinned to the foot of the screen while the bag has something in it.
// They are plain buttons on the storefront's own metrics: every touch target is 44px or more.
import type {ReactNode} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {bag, countOf, useBag, useBagQuantity} from '../orders/bag';
import {useAvailability} from '../orders/availability-store';
import {MAX_QUANTITY, formatRM, orderableDish} from '../orders/model';
import {Field} from '../system/Field';
import {count as counted} from '../lib/format';
import {Type} from '../system/Type';
import type {Dish, Storefront} from './model';
import s from './storefront.module.css';

/** "RM 28" or "RM 20.50": the storefront always says the currency, and sen only when there are any. */
export const formatPrice = (ringgit: number) => `RM\u00a0${Number.isInteger(ringgit) ? ringgit : ringgit.toFixed(2)}`;

/**
 * The one big action on a screen: a cobalt field, cream words, full width, 56px tall. A link
 * with `href`, otherwise a button; `busy` keeps it pressed while what it started is under way.
 */
export function Cta({children, href, id, onClick, type = 'button', isDisabled, busy}: {children: ReactNode; href?: string; id?: string; onClick?: () => void; type?: 'button' | 'submit'; isDisabled?: boolean; busy?: boolean}) {
  const face = (
    <Field as="span" colour="blue" outlined={false} className={s.ctaFace}>
      <Type role="body" className={s.ctaText}>
        {children}
      </Type>
    </Field>
  );
  if (href) return <a href={href} id={id} className={s.cta}>{face}</a>;
  return (
    <button type={type} id={id} className={s.cta} onClick={onClick} disabled={isDisabled || busy} aria-busy={busy || undefined} data-busy={busy ? '' : undefined}>
      {face}
    </button>
  );
}

/**
 * − n +, on any quantity the caller holds: the bag itself, or the sheet's choice before it is
 * added (`staged`, where a step to nothing removes only once the customer confirms).
 */
export function Stepper({name, quantity, onChange, min = 0, staged = false}: {name: string; quantity: number; onChange: (next: number) => void; min?: number; staged?: boolean}) {
  const removes = quantity === 1 && min === 0 && !staged;
  return (
    <span className={s.stepper} role="group" aria-label={`${name}, quantity`}>
      {/* At one, the next tap takes the dish out: × says so, not another −. */}
      <button type="button" className={s.stepperButton} aria-label={removes ? `Remove ${name}` : `One less ${name}`} onClick={() => onChange(quantity - 1)} disabled={quantity <= min}>
        <span aria-hidden>{removes ? '×' : '−'}</span>
      </button>
      <span className={s.stepperCount} aria-live="polite">
        <Type role="body">{quantity}</Type>
      </span>
      <button type="button" className={s.stepperButton} aria-label={`One more ${name}`} onClick={() => onChange(quantity + 1)} disabled={quantity >= MAX_QUANTITY}>
        <span aria-hidden>+</span>
      </button>
    </span>
  );
}

/**
 * The corner of a dish's photo: + adds one in a single tap; once the dish is in the bag the
 * corner shows how many, and a tap opens the dish to change it. Sold out while staff have it closed.
 */
export function AddToBag({dish, onOpen}: {dish: Dish; onOpen: () => void}) {
  const quantity = useBagQuantity(dish.id);
  const {ordersPaused, soldOut} = useAvailability();
  if (quantity > 0) {
    return (
      <button type="button" className={s.add} aria-label={`${quantity} ${dish.name} in bag, change`} aria-haspopup="dialog" onClick={onOpen}>
        <Field as="span" colour="blue" outlined={false} className={s.addFace}>
          <Type role="body" className={s.addCount}>
            {quantity}
          </Type>
        </Field>
      </button>
    );
  }
  if (soldOut[dish.id]) {
    return (
      <Field as="span" colour="paper" outlined={false} className={s.soldOut}>
        <Type role="label">Sold out</Type>
      </Field>
    );
  }
  return (
    <button type="button" className={s.add} aria-label={`Add ${dish.name} to bag`} onClick={() => bag.add(dish.id)} disabled={ordersPaused !== null}>
      <Field as="span" colour="blue" outlined={false} className={s.addFace}>
        <Type role="subhead" aria-hidden>
          +
        </Type>
      </Field>
    </button>
  );
}

/** Under the header while staff have paused online orders. */
export function PausedNotice() {
  const {ordersPaused} = useAvailability();
  if (!ordersPaused) return null;
  return <Banner status="warning" title={ordersPaused.until ? 'Online orders are paused for today.' : 'Online orders are paused.'} description="You can still order at the counter." />;
}

/** The header's action: Order now while the bag is empty (not on the menu, which is where it leads), then the bag and its count. */
export function BagButton({store, onMenu}: {store: Storefront; onMenu: boolean}) {
  const count = countOf(useBag());
  if (count > 0) return <Button variant="primary" label={`Bag, ${counted(count, 'item', 'items')}`} href="/checkout">{`Bag · ${count}`}</Button>;
  return onMenu ? null : <Button variant="primary" label="Order now" href={store.menu.href} />;
}

/** Pinned to the foot of the screen while the bag has something in it: one cobalt bar, one tap to checkout. */
export function BagBar({store}: {store: Storefront}) {
  const lines = useBag();
  if (lines.length === 0) return null;
  // Display only, so none of priceCart's refusals (a test item beside a dish): the server prices
  // the cart again at checkout and refuses what it must there.
  const totalSen = lines.reduce((sum, line) => sum + Math.round((orderableDish(store, line.dishId)?.price ?? 0) * 100) * line.quantity, 0);
  const count = countOf(lines);
  return (
    <aside className={s.bagBar} aria-label="Your bag">
      <Field colour="blue" outlined={false} className={s.bagBarField}>
        <a href="/checkout" className={s.bagBarLink}>
          <span className={s.bagCount}>
            <Type role="body">{count}</Type>
          </span>
          <Type role="body" className={s.bagBarLabel}>
            View bag<VisuallyHidden>, {counted(count, 'item', 'items')}</VisuallyHidden>
          </Type>
          <Type role="body" className={s.bagBarTotal}>
            {formatRM(totalSen)}
          </Type>
        </a>
      </Field>
    </aside>
  );
}
