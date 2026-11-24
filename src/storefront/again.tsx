// A returning customer's way back: a card that rises from the foot of the screen on the first
// browsing page of a visit. While their last order is in the kitchen it shows where the order is
// and leads to its page; once it is done, the same order goes back into the bag in one tap and
// checkout opens. It never blocks the page: × or a swipe down puts it away for the visit, and
// until then it waits on every browsing page without rising again.
import {useEffect, useRef, useState, type PointerEvent, type ReactNode} from 'react';
import {useRouter} from '@tanstack/react-router';
import {Cta} from './bag';
import {bag} from '../orders/bag';
import {settlePaying} from '../orders/settle';
import {useAvailability} from '../orders/availability-store';
import {getOrder, type PublicOrder} from '../orders/functions';
import {formatRM, orderableDish} from '../orders/model';
import {isUnderway, journey} from '../orders/journey';
import {orderAgainLines, useRecentOrder, type RecentOrder} from '../orders/recent';
import {Label} from '../system/components';
import {Field} from '../system/Field';
import {photoFor} from './photos';
import {Type} from '../system/Type';
import {formatShopTime, midSentence} from './hours';
import {footRef} from './foot';
import type {Storefront} from './model';
import s from './storefront.module.css';

/** After its pick-up time by this much, an order is done whatever the board says: nobody tracks yesterday's cake. */
const TRACK_HOURS = 12;

const isTracked = (order: PublicOrder, now: number) => isUnderway(order) && now < Date.parse(order.pickupAt) + TRACK_HOURS * 3_600_000;

/** How the last order stands: undefined while asking, null once there is nothing to track. */
function useTracked(recent: RecentOrder | null) {
  // Each answer is kept with the order it is about, so a newer order never shows an older one's status.
  const [answer, setAnswer] = useState<{id: string; order: PublicOrder | null} | null>(null);
  const id = recent?.id;
  // Long past its pick-up, the order needs no asking: Order again shows at once, with no jump.
  const past = recent !== null && Date.now() > Date.parse(recent.pickupAt) + TRACK_HOURS * 3_600_000;
  useEffect(() => {
    if (!id || past) return;
    let live = true;
    getOrder({data: {id}}).then(
      (order) => live && setAnswer({id, order: order && isTracked(order, Date.now()) ? order : null}),
      () => live && setAnswer({id, order: null}),
    );
    return () => {
      live = false;
    };
  }, [id, past]);
  if (past) return null;
  return answer && answer.id === id ? answer.order : undefined;
}

/** Settles payments that never came back to their page, once per page and again when it returns to view. */
function useSettlePaying() {
  useEffect(() => {
    const settle = () => void settlePaying();
    settle();
    const onVisible = () => document.visibilityState === 'visible' && settle();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}

/** Ids of the cards that have risen in this page's life, so a page reached in place shows them settled. */
const risen = new Set<string>();
const DISMISSED_KEY = 'cjt.again.dismissed';
/** How far down a finger must pull the card to put it away. */
const SWIPE_AWAY_PX = 56;
const cardHeight = footRef('foot-card');

type Presence = 'waiting' | 'rising' | 'settled' | 'leaving' | 'gone';

/** When the card is on screen: a beat after the page settles, once per card, until it is put away for the visit. */
function usePresence(id: string, ready: boolean) {
  const [presence, setPresence] = useState<Presence>('waiting');
  useEffect(() => {
    if (!ready) return;
    if (window.sessionStorage.getItem(DISMISSED_KEY) === id) return setPresence('gone');
    if (risen.has(id)) return setPresence('settled');
    const timer = window.setTimeout(() => {
      risen.add(id);
      setPresence('rising');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [id, ready]);
  const dismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, id);
    // Focus inside the card goes back to the page, not to nowhere, as the card leaves.
    if (document.activeElement instanceof HTMLElement && document.activeElement.closest(`.${s.lastCard}`)) document.querySelector('main')?.focus({preventScroll: true});
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Still rising, it simply goes: there is no settled place yet to leave from.
    setPresence(still || presence === 'rising' ? 'gone' : 'leaving');
  };
  return {presence, dismiss, settle: () => setPresence('settled'), done: () => setPresence('gone')};
}

/** Up to three photos of what was ordered, overlapping like a short stack of plates. */
function Plates({ids}: {ids: readonly string[]}) {
  return (
    <span className={s.plates} aria-hidden>
      {ids.slice(0, 3).map((id) => {
        const photo = photoFor(id);
        return photo ? (
          <img key={id} src={photo.src} srcSet={photo.srcSet} sizes="40px" alt="" className={s.plate} />
        ) : (
          <span key={id} className={s.plate} />
        );
      })}
    </span>
  );
}

function Card({id, ready, eyebrow, ids, children, action}: {id: string; ready: boolean; eyebrow: string; ids: readonly string[]; children: ReactNode; action: ReactNode}) {
  const {presence, dismiss, settle, done} = usePresence(id, ready);
  const drag = useRef<{y: number} | null>(null);
  const [pulled, setPulled] = useState(0);
  if (presence === 'waiting' || presence === 'gone') return null;

  const grab = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('a, button')) return;
    drag.current = {y: event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pull = (event: PointerEvent<HTMLElement>) => drag.current && setPulled(Math.max(0, event.clientY - drag.current.y));
  const letGo = () => {
    if (!drag.current) return;
    drag.current = null;
    if (pulled > SWIPE_AWAY_PX) dismiss();
    setPulled(0);
  };

  return (
    <Field
      ref={cardHeight}
      as="section"
      colour="paper"
      outlined={false}
      aria-label="Your last order"
      className={s.lastCard}
      data-presence={presence}
      data-pulled={pulled > 0 ? '' : undefined}
      style={pulled > 0 ? {translate: `0 ${pulled}px`} : undefined}
      onPointerDown={grab}
      onPointerMove={pull}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      onKeyDown={(event) => event.key === 'Escape' && dismiss()}
      onAnimationEnd={(event) => event.target === event.currentTarget && presence === 'rising' && settle()}
      onTransitionEnd={(event) => event.target === event.currentTarget && event.propertyName === 'opacity' && presence === 'leaving' && done()}
    >
      <span className={s.lastCardHead}>
        <Label ink="secondary">{eyebrow}</Label>
        <button type="button" className={s.lastCardClose} aria-label="Close" onClick={dismiss}>
          <Type role="subhead" className={s.glyph} aria-hidden>
            ×
          </Type>
        </button>
      </span>
      <span className={s.lastCardBody}>
        <Plates ids={ids} />
        <span className={s.lastCardText}>{children}</span>
      </span>
      {action}
    </Field>
  );
}

export function LastOrder({store}: {store: Storefront}) {
  const router = useRouter();
  useSettlePaying();
  const recent = useRecentOrder();
  const tracked = useTracked(recent);
  const availability = useAvailability();
  if (!recent) return null;
  const ids = recent.lines.map((line) => line.dishId);

  // In the kitchen: where it is, as the order page's steps, and the way to it. It waits for the
  // answer, so it never rises empty.
  if (tracked || tracked === undefined) {
    const trip = tracked ? journey(tracked) : null;
    const reached = trip?.reached ?? -1;
    const title = trip?.title ?? '';
    const when = tracked?.delivery ? `Arrives ${midSentence(formatShopTime(store.timeZone, tracked.delivery.arrivesAt)).replace(', ', ', about ')}` : `Pick-up ${midSentence(formatShopTime(store.timeZone, recent.pickupAt))}`;
    return (
      <Card
        id={`${recent.id}:track`}
        ready={tracked !== undefined}
        eyebrow={`Order ${recent.code}`}
        ids={ids}
        action={
          <Cta href={`/order/${recent.id}`} label={`Track your order, ${recent.code}: ${title}`}>
            Track your order
          </Cta>
        }
      >
        <Type role="body" className={s.lastCardTitle}>
          {title}
        </Type>
        <Type role="caption" ink="secondary">
          {when}
        </Type>
        <span className={s.lastCardSteps} aria-hidden>
          {(trip?.steps ?? []).map((label, index) => (
            <span key={label} data-done={index <= reached ? '' : undefined} />
          ))}
        </span>
      </Card>
    );
  }

  const lines = orderAgainLines(recent.lines, availability);
  if (lines.length === 0) return null;
  const left = recent.lines.flatMap((line) => {
    const dish = lines.some((kept) => kept.dishId === line.dishId) ? undefined : orderableDish(store, line.dishId);
    return dish ? [dish] : [];
  });
  // "Today" only when every one of them comes back tomorrow; staff can also close a dish until they reopen it.
  const soldOutLine = `${left.every((dish) => availability.soldOut[dish.id]?.until) ? 'Sold out today' : 'Sold out'}: ${left.map((dish) => dish.name).join(', ')}`;
  const named = lines.flatMap((line) => {
    const dish = orderableDish(store, line.dishId);
    return dish ? [{...line, dish}] : [];
  });
  const totalSen = named.reduce((sum, line) => sum + Math.round(line.dish.price * 100) * line.quantity, 0);
  const summary = named.map((line) => (line.quantity > 1 ? `${line.quantity} × ${line.dish.name}` : line.dish.name)).join(', ');
  return (
    <Card
      id={`${recent.id}:again`}
      ready
      eyebrow="Welcome back"
      ids={lines.map((line) => line.dishId)}
      action={
        <Cta
          value={formatRM(totalSen)}
          label={`Order again: ${summary}, ${formatRM(totalSen)}`}
          onClick={() => {
            bag.include(lines);
            void router.navigate({href: '/checkout'});
          }}
        >
          Order again
        </Cta>
      }
    >
      <Type role="body" className={s.lastCardTitle}>
        Your last order
      </Type>
      <Type role="caption" ink="secondary">
        {summary}
      </Type>
      {left.length > 0 ? (
        <Type role="caption" ink="secondary">
          {soldOutLine}
        </Type>
      ) : null}
    </Card>
  );
}
