// The bag's controls: one-tap Add on every dish, a stepper once it is in the bag, the header
// button, and the bar pinned to the foot of the screen while the bag has something in it.
// They are plain buttons on the storefront's own metrics: every touch target is 44px or more.
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {bag, countOf, useBag, useBagQuantity, useBagReady} from '../orders/bag';
import {useAvailability} from '../orders/availability-store';
import {MAX_QUANTITY, formatRM, orderableDish, type CartLine} from '../orders/model';
import {Field, useGround} from '../system/Field';
import {count as counted} from '../lib/format';
import {Type} from '../system/Type';
import type {Action, Dish, Storefront} from './model';
import {PAUSED, promiseLine, usePickupPromise} from './promise';
import {footRef} from './foot';
import {StoreLink} from './link';
import s from './storefront.module.css';

/** "RM 28" or "RM 20.50": the storefront always says the currency, and sen only when there are any. */
export const formatPrice = (ringgit: number) => `RM\u00a0${Number.isInteger(ringgit) ? ringgit : ringgit.toFixed(2)}`;

/** A short buzz under the finger as a dish goes into the bag, on the phones that can (Android); elsewhere nothing. */
export const tick = () => {
  if ('vibrate' in navigator) navigator.vibrate(8);
};

const barHeight = footRef('foot-bar');

/**
 * True on the render where `value` changes once the page is live, so a count lands with a pop when
 * it changes, not when a page opens with it (or the stored bag is read on load).
 */
function useChanged<T>(value: T) {
  const ready = useBagReady();
  const last = useRef<{value: T} | null>(null);
  const changed = ready && last.current !== null && last.current.value !== value;
  useEffect(() => {
    if (ready) last.current = {value};
  });
  return changed;
}

/** "RM 54.00" with the currency in small capitals, so the figures carry the amount. */
function Money({text, role = 'body'}: {text: string; role?: 'body' | 'subhead'}) {
  const figures = /^RM\s(.+)$/.exec(text)?.[1];
  return (
    <Type role={role} className={s.amount}>
      {figures ? (
        <>
          <span className={s.currency}>RM</span> {figures}
        </>
      ) : (
        text
      )}
    </Type>
  );
}

/** The cobalt square at a ticket's end, with the arrow; ink on a cobalt ground, where cobalt would vanish. */
function Go() {
  return (
    <Field as="span" colour={useGround() === 'blue' ? 'ink' : 'blue'} outlined={false} className={s.ticketGo} aria-hidden>
      <Type role="subhead">→</Type>
    </Field>
  );
}

/**
 * The one big action on a screen, as a counter ticket: a cream field with what it does on the
 * left and, when it costs something, the amount on the right, then a cobalt square with the
 * arrow; on a cream band the field is paper, so the ticket still stands out. A link with `href`,
 * otherwise a button; `busy` keeps it pressed while what it started is under way, without
 * disabling it, so focus stays on it. `label` names it for a screen reader when the words alone
 * are not enough.
 */
export function Cta({children, value, label, compact = false, href, id, onClick, type = 'button', isDisabled, busy}: {
  children: ReactNode;
  value?: string;
  label?: string;
  /** 40px, for the header. */
  compact?: boolean;
  href?: string;
  id?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  isDisabled?: boolean;
  busy?: boolean;
}) {
  const body = useGround() === 'cream-400' ? 'paper' : 'cream-400';
  const face = (
    <span className={s.ticket}>
      <Field as="span" colour={body} outlined={false} className={s.ticketBody}>
        <Type role="body" className={s.ticketLabel}>
          {children}
        </Type>
        {value ? (
          <>
            {' '}
            <Money text={value} />
          </>
        ) : null}
      </Field>
      <Go />
    </span>
  );
  const size = compact ? '' : undefined;
  if (href) return <StoreLink href={href} id={id} className={s.cta} aria-label={label} data-compact={size}>{face}</StoreLink>;
  return (
    <button type={type} id={id} className={s.cta} onClick={busy ? undefined : onClick} disabled={isDisabled} aria-disabled={busy || undefined} aria-label={label} aria-busy={busy || undefined} data-busy={busy ? '' : undefined} data-compact={size}>
      {face}
    </button>
  );
}

/**
 * − n +, on any quantity the caller holds: the bag itself, or the sheet's choice before it is
 * added (`staged`, where a step to nothing removes only once the customer confirms). At either
 * end a button says it does nothing (aria-disabled) rather than disabling, so the focus on it stays.
 */
export function Stepper({name, quantity, onChange, min = 0, staged = false}: {name: string; quantity: number; onChange: (next: number) => void; min?: number; staged?: boolean}) {
  const removes = quantity === 1 && min === 0 && !staged;
  const atLeast = quantity <= min;
  const atMost = quantity >= MAX_QUANTITY;
  return (
    <span className={s.stepper} role="group" aria-label={`${name}, quantity`}>
      {/* At one, the next tap takes the dish out: × says so, not another −. */}
      <button type="button" className={s.stepperButton} aria-label={removes ? `Remove ${name}` : `One less ${name}`} onClick={() => !atLeast && onChange(quantity - 1)} aria-disabled={atLeast || undefined}>
        <span className={s.glyph} aria-hidden>
          {removes ? '×' : '−'}
        </span>
      </button>
      <span className={s.stepperCount} aria-live="polite">
        <Type role="body">{quantity}</Type>
      </span>
      <button type="button" className={s.stepperButton} aria-label={`One more ${name}`} onClick={() => !atMost && onChange(quantity + 1)} aria-disabled={atMost || undefined}>
        <span className={s.glyph} aria-hidden>
          +
        </span>
      </button>
    </span>
  );
}

/** A corner in a sideways row (checkout's add-ons) scrolls into view when the keyboard reaches it. */
const showWhole = (event: {currentTarget: HTMLElement}) => event.currentTarget.scrollIntoView({block: 'nearest', inline: 'nearest'});

/**
 * The corner of a dish's photo: + adds one in a single tap; once the dish is in the bag the
 * corner shows how many, and a tap opens the dish to change it. Sold out while staff have it closed.
 */
export function AddToBag({dish, onOpen}: {dish: Dish; onOpen: () => void}) {
  const quantity = useBagQuantity(dish.id);
  const changed = useChanged(quantity);
  const {ordersPaused, soldOut} = useAvailability();
  if (quantity > 0) {
    return (
      <button type="button" className={s.add} aria-label={`Change ${dish.name}, ${quantity} in bag`} aria-haspopup="dialog" onClick={onOpen} onFocus={showWhole}>
        {/* Keyed on the quantity, so each change lands with a pop where the finger is. */}
        <Field as="span" colour="cream-400" outlined={false} className={changed ? `${s.addFace} ${s.addCounted}` : s.addFace} key={quantity}>
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
    <button type="button" className={s.add} aria-label={`Add ${dish.name} to bag`} onClick={() => {
        bag.add(dish.id);
        tick();
      }} disabled={ordersPaused !== null} onFocus={showWhole}>
      <Field as="span" colour="blue" outlined={false} className={s.addFace}>
        <Type role="subhead" className={s.glyph} aria-hidden>
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

/**
 * One quiet line for a screen reader, wherever a dish went in or came out (the + on a photo, the
 * sheet, the stepper): what the bag holds now. It says nothing when a page opens.
 */
export function BagStatus({store}: {store: Storefront}) {
  const lines = useBag();
  const count = countOf(lines);
  const total = formatRM(bagTotalSen(store, lines));
  const changed = useChanged(`${count} ${total}`);
  const [said, setSaid] = useState('');
  useEffect(() => {
    if (changed) setSaid(count > 0 ? `${counted(count, 'item', 'items')} in your bag, ${total}` : 'Your bag is empty');
  }, [changed, count, total]);
  return (
    <p role="status" className={s.srOnly}>
      {said}
    </p>
  );
}

// Display only, so none of priceCart's refusals (a test item beside a dish): the server prices
// the cart again at checkout and refuses what it must there.
const bagTotalSen = (store: Storefront, lines: readonly CartLine[]) =>
  lines.reduce((sum, line) => sum + Math.round((orderableDish(store, line.dishId)?.price ?? 0) * 100) * line.quantity, 0);

/**
 * The header's action from 600px up, where it is the only one (a phone has BagBar instead): Order
 * now while the bag is empty (not on the menu, which is where it leads), then the bag, its count
 * and its total.
 */
export function BagButton({store, onMenu}: {store: Storefront; onMenu: boolean}) {
  const lines = useBag();
  const count = countOf(lines);
  const changed = useChanged(count);
  if (count > 0) {
    const total = formatRM(bagTotalSen(store, lines));
    return (
      <Cta href="/checkout" compact value={total} label={`Bag, ${counted(count, 'item', 'items')}, ${total}`}>
        {/* Keyed on the count, so an add made far down the page still lands up here with a pop. */}
        <span key={count} className={changed ? s.recount : undefined}>
          Bag · {count}
        </span>
      </Cta>
    );
  }
  return onMenu ? null : (
    <Cta href={store.menu.href} compact>
      Order now
    </Cta>
  );
}

/** The bag's soonest pick-up, under View bag: what is in it decides, so a breakfast says morning. */
function BagPromise({store, lines}: {store: Storefront; lines: readonly CartLine[]}) {
  const promise = usePickupPromise(store, lines);
  return promise ? (
    <Type role="caption" ink="secondary">
      {promise.soonest}
    </Type>
  ) : null;
}

/** Whether the element with this id is out of sight: null until the page is live, true when there is no such element. */
function useOutOfView(id: string | undefined) {
  const [out, setOut] = useState<boolean | null>(null);
  useEffect(() => {
    if (!id) return setOut(null);
    const target = document.getElementById(id);
    if (!target) return setOut(true);
    const observer = new IntersectionObserver(([entry]) => setOut(!entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [id]);
  return out;
}

/**
 * The foot of a phone's screen, where the thumb rests, always holds the next step. From 600px up
 * the header's BagButton does instead, so the bag is never shown twice. While the bag
 * has something in it: one cobalt bar, the count, View bag, the soonest pick-up and the total, one
 * tap to checkout. While it is empty and the page names an `idle` action: that action and whether
 * the shop is open, once the page's own button for it (`standsIn`, an element id) has scrolled out
 * of sight, so the two are never on screen together. The idle bar is for phones; a wide screen has
 * the header's.
 */
export function BagBar({store, idle}: {store: Storefront; idle?: {action: Action; standsIn: string}}) {
  const lines = useBag();
  const ready = useBagReady();
  const pageActionHidden = useOutOfView(lines.length === 0 ? idle?.standsIn : undefined);
  const promise = usePickupPromise(store);
  const {ordersPaused} = useAvailability();
  const count = countOf(lines);
  const changed = useChanged(count);
  // It rises in when the bag fills on this page, not each time a page opens with a full bag: the
  // page's bag is known once the stored one has been read.
  const openedEmpty = useRef<boolean | null>(null);
  if (ready && openedEmpty.current === null) openedEmpty.current = lines.length === 0;
  if (lines.length === 0) {
    if (!idle) return null;
    const hidden = pageActionHidden !== true;
    // While online orders are paused the bar still leads to the menu, and says why it is not an order.
    const note = ordersPaused ? PAUSED : promise ? promiseLine(promise) : null;
    return (
      <aside ref={hidden ? undefined : barHeight} className={s.bagBar} aria-label="Order" data-idle="" data-hidden={hidden ? '' : undefined} inert={hidden}>
        <Field colour="cream-400" outlined={false} className={s.bagBarField}>
          <StoreLink href={idle.action.href} className={s.bagBarLink}>
            <span className={s.bagBarBody}>
              <span className={s.bagBarLabel}>
                <Type role="label">{ordersPaused ? 'See the menu' : idle.action.label}</Type>
                {note ? (
                  <Type role="caption" ink="secondary">
                    {note}
                  </Type>
                ) : null}
              </span>
            </span>
            <Go />
          </StoreLink>
        </Field>
      </aside>
    );
  }
  const totalSen = bagTotalSen(store, lines);
  return (
    <aside ref={barHeight} className={s.bagBar} aria-label="Your bag" data-rise={openedEmpty.current ? '' : undefined}>
      <Field colour="cream-400" outlined={false} className={s.bagBarField}>
        <StoreLink href="/checkout" className={s.bagBarLink}>
          <span className={s.bagBarBody}>
            <span className={s.bagBarLabel}>
              {/* Keyed on the count, so each change lands where the eye is: the add was heard. */}
              <Type role="label" key={count} className={changed ? s.bagBarTitle : undefined}>
                View bag · {counted(count, 'item', 'items')}
              </Type>
              <BagPromise store={store} lines={lines} />
            </span>
            <Money text={formatRM(totalSen)} role="subhead" />
          </span>
          <Go />
        </StoreLink>
      </Field>
    </aside>
  );
}
