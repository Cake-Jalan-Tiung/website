// The kitchen's screen, for a tablet at the counter: new orders ring, every ticket has one
// action, and the board follows itself. Signed in with the shop's staff PIN.
import {useEffect, useRef, useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Switch} from '@astryxdesign/core/Switch';
import {TextInput} from '@astryxdesign/core/TextInput';
import {storefront} from '../site/content';
import {Columns, Row, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {formatShopTime} from '../storefront/hours';
import {Sections} from '../storefront/sections';
import {advanceOrder, getStaffBoard, setAvailability, staffLogin, staffLogout, type StaffOrder} from './functions';
import {showAvailability, useAvailability} from './availability-store';
import type {CloseFor} from './availability';
import {KITCHEN_COLUMNS, TEST_DISH, kitchenNext, formatRM} from './model';
import {bag} from './bag';
import s from './orders.module.css';

const POLL_MS = 5000;
/** Within this many minutes a ticket counts down; further out it shows the time. */
const COUNTDOWN_MINUTES = 90;
const isNewStatus = (order: StaffOrder) => order.status === KITCHEN_COLUMNS[0].status;

/** Three short tones, loud enough to hear over a kitchen. Needs one tap first: browsers block sound until then. */
function ring(context: AudioContext) {
  [0, 0.35, 0.7].forEach((start) => {
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.6, context.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + 0.3);
    tone.connect(gain).connect(context.destination);
    tone.start(context.currentTime + start);
    tone.stop(context.currentTime + start + 0.32);
  });
}

function minutesUntil(iso: string, now: number) {
  return Math.round((Date.parse(iso) - now) / 60_000);
}

function Ticket({order, isNew, onMoved}: {order: StaffOrder; isNew: boolean; onMoved: () => void}) {
  const [error, setError] = useState<string | null>(null);
  const next = kitchenNext(order.status);
  const minutes = minutesUntil(order.pickupAt, Date.now());
  return (
    <article className={s.ticket} data-new={isNew ? '' : undefined} aria-label={`Order ${order.code} for ${order.name}`}>
      <span className={s.ticketHead}>
        <Type role="subhead" as="h3">
          <span className={s.code}>{order.code}</span> · {order.name}
        </Type>
        <Type role="body" className={minutes < 0 ? s.late : undefined}>
          {minutes < 0 ? `Late ${-minutes} min` : minutes <= COUNTDOWN_MINUTES ? `In ${minutes} min` : formatShopTime(storefront.timeZone, order.pickupAt)}
        </Type>
      </span>
      <ul className={s.items}>
        {order.items.map((item) => (
          <li key={item.dishId}>
            <Type role="body">
              <strong>{item.quantity} ×</strong> {item.name}
            </Type>
          </li>
        ))}
      </ul>
      {order.note ? (
        <span className={s.note}>
          <Type role="body">Note: {order.note}</Type>
        </span>
      ) : null}
      <Row justify="between" align="center" gap="sm">
        <a href={`tel:${order.phone}`}>
          <Type role="caption" ink="secondary">{order.phone} · {formatRM(order.totalSen)} paid</Type>
        </a>
        {next ? (
          <Button
            variant={isNewStatus(order) ? 'primary' : 'secondary'}
            size="lg"
            label={next.label}
            clickAction={async () => {
              const result = await advanceOrder({data: {id: order.id}});
              setError(result.ok ? null : result.message);
              onMoved();
            }}
          />
        ) : null}
      </Row>
      {error ? <Banner status="error" title={error} /> : null}
    </article>
  );
}

/** Pause online ordering, and mark dishes sold out for the rest of the day. */
function Availability() {
  const availability = useAvailability();
  const [error, setError] = useState<string | null>(null);
  const change = async (data: {dishId?: string; closeFor: CloseFor | 'open'}) => {
    const result = await setAvailability({data});
    if (result.ok) showAvailability(result.availability);
    setError(result.ok ? null : result.message);
  };
  const paused = availability.ordersPaused;
  return (
    <section className={s.column} aria-labelledby="availability">
      <Stack gap="md">
        <Type role="subhead" as="h2" id="availability">Online ordering</Type>
        {paused ? (
          <Stack gap="sm">
            <Banner
              status="warning"
              title={paused.until ? 'Paused for the rest of today' : 'Paused until you resume'}
              description="Customers can see the menu but cannot order. Orders already paid stay on the board."
            />
            <Button variant="primary" label="Resume online orders" clickAction={() => change({closeFor: 'open'})} />
          </Stack>
        ) : (
          <Row gap="sm">
            <Button variant="secondary" label="Pause for today" clickAction={() => change({closeFor: 'today'})} />
            <Button variant="secondary" label="Pause until I resume" clickAction={() => change({closeFor: 'until-reopened'})} />
          </Row>
        )}
        <Type role="subhead" as="h3">Sold out today</Type>
        <Type role="body" ink="secondary">A dish switched on here cannot be ordered online until tomorrow.</Type>
        <Columns count={3} gap="md" align="start">
          {storefront.categories.map((category) => (
            <Stack key={category.id} gap="sm">
              <Type role="label" as="h4">{category.name}</Type>
              {category.dishes.map((dish) => (
                <Switch
                  key={dish.id}
                  size="sm"
                  label={dish.name}
                  value={availability.soldOut[dish.id] !== undefined}
                  changeAction={(checked) => change({dishId: dish.id, closeFor: checked ? 'today' : 'open'})}
                />
              ))}
            </Stack>
          ))}
        </Columns>
        {error ? <Banner status="error" title={error} /> : null}
      </Stack>
    </section>
  );
}

function SignIn({onSignedIn}: {onSignedIn: () => void}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const result = await staffLogin({data: {pin}});
    setBusy(false);
    if (result.ok) onSignedIn();
    else setError(result.message);
  };
  return (
    <form className={s.pin} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <Type role="display" as="h1">Kitchen</Type>
      <TextInput label="Staff PIN" type="password" value={pin} onChange={setPin} hasAutoFocus status={error ? {type: 'error', message: error} : undefined} />
      <Button type="submit" variant="primary" size="lg" label="Sign in" isLoading={busy} />
    </form>
  );
}

export function StaffBoard({initial}: {initial: StaffOrder[] | null}) {
  const [orders, setOrders] = useState(initial);
  const [sound, setSound] = useState<AudioContext | null>(null);
  // New orders already on the board when it opened (or when staff signed in) are not
  // announced or highlighted; every later one is.
  const onOpen = useRef(new Set((initial ?? []).filter(isNewStatus).map((o) => o.id)));
  const rung = useRef(new Set(onOpen.current));
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const refresh = async ({opening = false} = {}) => {
    const next = await getStaffBoard();
    if (opening) {
      for (const order of (next ?? []).filter(isNewStatus)) {
        onOpen.current.add(order.id);
        rung.current.add(order.id);
      }
    }
    setOrders(next);
    const arrived = (next ?? []).filter((o) => isNewStatus(o) && !rung.current.has(o.id));
    arrived.forEach((o) => rung.current.add(o.id));
    if (arrived.length > 0 && soundRef.current) ring(soundRef.current);
  };

  const signedIn = orders !== null;
  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
    // `refresh` reads only refs and stable setters, so the timer is set once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const waiting = (orders ?? []).filter(isNewStatus).length;
  useEffect(() => {
    document.title = waiting > 0 ? `(${waiting}) New orders — Kitchen` : 'Kitchen — Cake Jalan Tiung';
  }, [waiting]);

  if (orders === null) {
    return (
      <Sections>
        <SignIn onSignedIn={() => void refresh({opening: true})} />
      </Sections>
    );
  }

  const collected = orders.filter((o) => o.status === 'collected').length;

  return (
    <Sections>
      <Stack gap="lg">
        <Row justify="between" align="center" gap="md">
          <Type role="head" as="h1">Kitchen</Type>
          <Row gap="sm" align="center">
            {sound ? (
              <Type role="caption" ink="secondary">Sound on</Type>
            ) : (
              <Button variant="primary" label="Turn on sound" onClick={() => { const context = new AudioContext(); ring(context); setSound(context); }} />
            )}
            <Button
              variant="secondary"
              label={`Test order (${formatRM(Math.round(TEST_DISH.price * 100))})`}
              onClick={() => { bag.clear(); bag.set(TEST_DISH.id, 1); window.location.assign('/checkout'); }}
            />
            <Button variant="ghost" label="Sign out" clickAction={async () => { await staffLogout(); setOrders(null); }} />
          </Row>
        </Row>
        {!sound ? <Banner status="info" title="Tap Turn on sound so new orders ring. Browsers keep pages silent until someone taps." /> : null}
        <Columns count={3} gap="md" align="start">
          {KITCHEN_COLUMNS.map((column) => {
            const tickets = orders.filter((o) => o.status === column.status);
            return (
              <section key={column.status} className={s.column} aria-labelledby={`column-${column.status}`}>
                <Type role="subhead" as="h2" id={`column-${column.status}`}>
                  {column.title} ({tickets.length})
                </Type>
                {tickets.length === 0 ? <Type role="body" ink="secondary">Nothing here.</Type> : null}
                {tickets.map((order) => (
                  <Ticket
                    key={order.id}
                    order={order}
                    isNew={isNewStatus(order) && !onOpen.current.has(order.id)}
                    onMoved={() => void refresh()}
                  />
                ))}
              </section>
            );
          })}
        </Columns>
        <Type role="caption" ink="secondary">{collected} collected today.</Type>
        <Availability />
      </Stack>
    </Sections>
  );
}
