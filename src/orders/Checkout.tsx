// Checkout on one page: the bag, a pick-up time, who collects it, how to pay, then Pay, pinned
// to the foot of the screen. Prices, times and payment methods come from the server for the
// bag as it stands. A returning customer's details and way to pay are remembered.
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Link} from '@astryxdesign/core/Link';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {storefront} from '../site/content';
import {textAt} from '../lib/guards';
import {AddToBag, Cta, Stepper, formatPrice} from '../storefront/bag';
import {photoFor} from '../storefront/photos';
import {Media, StoreHeader} from '../storefront/sections';
import {suggestionsFor} from '../storefront/suggest';
import {useAvailability} from './availability-store';
import {formatSpan} from '../storefront/hours';
import {Label} from '../system/components';
import {Field} from '../system/Field';
import {count as counted, list} from '../lib/format';
import {Page, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {bag, countOf, payingFor, useBag, useBagReady} from './bag';
import {TEST_DISH, customerProblems, formatRM, orderableDish, type CartLine, type Customer, type CustomerField} from './model';
import {getCheckoutOptions, placeOrder, type CheckoutOptions} from './functions';
import type {PaymentMethod} from '../payments/provider';
import s from './orders.module.css';

const DETAILS_KEY = 'cjt.customer.v1';
const METHOD_KEY = 'cjt.method.v1';
const NO_DETAILS: Customer = {name: '', phone: '', email: '', note: ''};

/** The details saved from the last order; the note is never kept. */
function readDetails(): Customer {
  let saved: unknown;
  try {
    saved = JSON.parse(window.localStorage.getItem(DETAILS_KEY) ?? 'null');
  } catch {
    return NO_DETAILS;
  }
  return {name: textAt(saved, 'name'), phone: textAt(saved, 'phone'), email: textAt(saved, 'email'), note: ''};
}

const isComplete = (details: Customer) => Object.keys(customerProblems(details)).length === 0;

/** One choice per kind of payment: the card networks become a single Card. */
function paymentChoices(methods: readonly PaymentMethod[]) {
  const seen = new Set<string>();
  return methods.flatMap((method) => {
    const key = method.kind === 'other' ? method.id : method.kind;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{value: method.id, label: method.kind === 'card' ? 'Credit or debit card' : method.name}];
  });
}

type Choice = {value: string; label: string; note?: string};

/** A group of choices drawn as chips or rows: native radios, so the keyboard and screen readers get a real group. */
function Choices({legend, name, options, value, onChange, look}: {
  legend: string;
  name: string;
  options: readonly Choice[];
  value: string | undefined;
  onChange: (value: string) => void;
  look: 'chips' | 'rows';
}) {
  return (
    <fieldset className={look === 'rows' ? s.rows : s.chips}>
      <VisuallyHidden as="legend">{legend}</VisuallyHidden>
      {options.map((option) => (
        <label key={option.value} className={look === 'rows' ? s.choiceRow : s.chip}>
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
          {look === 'rows' ? <span className={s.tick} aria-hidden /> : null}
          <Type role="body">{option.label}</Type>
          {option.note ? <Type role="caption" ink="secondary">{option.note}</Type> : null}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * One optional row under the bag, never a step in the way: a dish from each add-on the bag lacks.
 * The offer is set when checkout opens; adding one takes it out of the row and puts nothing in
 * its place, so the row only ever gets shorter.
 */
function AddOns({lines}: {lines: readonly CartLine[]}) {
  const {ordersPaused, soldOut} = useAvailability();
  const [offered] = useState(() => suggestionsFor(storefront, lines, (id) => photoFor(id) !== undefined));
  const inBag = new Set(lines.map((line) => line.dishId));
  const shown = offered.filter((dish) => !inBag.has(dish.id) && !soldOut[dish.id]);
  // The staff test item sits alone in its cart, so nothing is offered beside it.
  if (ordersPaused || inBag.has(TEST_DISH.id) || shown.length === 0) return null;
  return (
    <section className={s.addOns} aria-labelledby="add-ons">
      <Label ink="secondary" as="h3" id="add-ons">Add to your order</Label>
      <ul className={s.addOnList}>
        {shown.map((dish) => (
          <li key={dish.id} className={s.addOn}>
            <span className={s.addOnMedia}>
              <Media id={dish.id} alt="" ratio="1 / 1" drawing={dish.drawing} />
              <span className={s.addOnCorner}>
                <AddToBag dish={dish} onOpen={() => undefined} />
              </span>
            </span>
            <span className={s.addOnName}>
              <Type role="caption">{dish.name}</Type>
            </span>
            <Type role="caption" className={s.money}>{formatPrice(dish.price)}</Type>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A numbered step: its number and title over an ink rule. */
function Step({n, id, title, aside, children}: {n: number; id: string; title: string; aside?: ReactNode; children: ReactNode}) {
  return (
    <section className={s.step} aria-labelledby={id}>
      <span className={s.stepHead}>
        <Label ink="secondary">{String(n).padStart(2, '0')}</Label>
        <Type role="subhead" as="h2" id={id} className={s.stepTitle}>{title}</Type>
        {aside}
      </span>
      {children}
    </section>
  );
}

function Shell({children}: {children: ReactNode}) {
  return (
    <Page top={<StoreHeader store={storefront} mode="focus" />}>
      <div className={s.checkout}>{children}</div>
    </Page>
  );
}

export function Checkout() {
  const lines = useBag();
  const ready = useBagReady();
  const submitting = useRef(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [loadError, setLoadError] = useState<{message: string; canRetry: boolean} | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [details, setDetails] = useState<Customer>(NO_DETAILS);
  const [editing, setEditing] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Field problems show once Pay has been tried, then follow the customer's typing.
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Back from the payment page, a phone may restore this page as it was left: Pay pressed.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      submitting.current = false;
      setPlacing(false);
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  useEffect(() => {
    const saved = readDetails();
    setDetails(saved);
    setEditing(!isComplete(saved));
    setMethod(window.localStorage.getItem(METHOD_KEY));
  }, []);

  // `lines` is the bag store's own snapshot, so it changes identity only when the bag does.
  useEffect(() => {
    if (lines.length === 0) return;
    let live = true;
    getCheckoutOptions({data: {cart: lines}}).then(
      (result) => {
        if (!live) return;
        if (!result.ok) return setLoadError({message: result.message, canRetry: result.canRetry ?? false});
        setLoadError(null);
        setOptions(result);
      },
      () => live && setLoadError({message: 'Could not reach the shop. Check your connection and try again.', canRetry: true}),
    );
    return () => {
      live = false;
    };
  }, [lines, attempt]);

  if (!ready) {
    return (
      <Shell>
        <Type role="head" as="h1">Checkout</Type>
      </Shell>
    );
  }

  if (lines.length === 0) {
    return (
      <Shell>
        <Stack gap="lg">
          <Stack gap="sm">
            <Type role="head" as="h1">Your bag is empty</Type>
            <Type role="body" as="p">Add something from the menu and it will wait here.</Type>
          </Stack>
          <Cta href={storefront.menu.href} id="see-menu">See the menu</Cta>
        </Stack>
      </Shell>
    );
  }

  // The chosen time holds while it is still offered; otherwise the earliest is chosen.
  const slots = options?.slots ?? [];
  const activeSlot = slots.find((option) => option.at === slot) ?? slots[0];
  const days = [...new Map(slots.map((option) => [option.date, option.day])).entries()];
  const times = slots.filter((option) => option.date === activeSlot?.date);
  const choices = paymentChoices(options?.methods ?? []);
  const activeMethod = choices.find((choice) => choice.value === method)?.value;
  const limits = options?.window;
  const itemCount = countOf(lines);
  const problems = checked ? customerProblems(details) : {};
  const fieldStatus = (key: CustomerField) => (problems[key] ? {type: 'error' as const, message: problems[key]} : undefined);
  const update = (key: keyof Customer) => (value: string) => {
    setDetails((was) => ({...was, [key]: value}));
    setError(null);
  };
  const choose = (value: string) => {
    setMethod(value);
    setError(null);
  };
  /** Pay sits at the foot of the screen; what stops it may be far above, so take the customer there. */
  const showStep = (id: string, message: string) => {
    setError(message);
    requestAnimationFrame(() => {
      const step = document.getElementById(id)?.closest('section');
      step?.scrollIntoView({block: 'start'});
      // In order of preference: a field that is wrong, then a way to pay, then the first field.
      const field = ['[aria-invalid="true"]', 'input[type=radio]', 'input'].map((selector) => step?.querySelector<HTMLElement>(selector)).find(Boolean);
      field?.focus({preventScroll: true});
    });
  };
  const retry = () => {
    setLoadError(null);
    setAttempt((n) => n + 1);
  };
  /** Taking a line out moves focus to the line that takes its place, or to the menu once the bag is empty. */
  const remove = (dishId: string) => {
    const at = lines.findIndex((line) => line.dishId === dishId);
    const next = lines[at + 1] ?? lines[at - 1];
    bag.set(dishId, 0);
    requestAnimationFrame(() => {
      const target = next ? document.querySelector<HTMLElement>(`[data-line="${next.dishId}"] button:not(:disabled)`) : document.getElementById('see-menu');
      target?.focus();
    });
  };

  async function pay() {
    if (submitting.current) return;
    if (!activeSlot) return showStep('when', 'Choose a pick-up time.');
    const found = Object.values(customerProblems(details));
    if (found.length > 0) {
      setChecked(true);
      setEditing(true);
      return showStep('who', found.length === 1 ? found[0] : 'Check your details: some need a fix.');
    }
    if (!activeMethod) return showStep('how', 'Choose a way to pay.');
    submitting.current = true;
    setError(null);
    setPlacing(true);
    window.localStorage.setItem(DETAILS_KEY, JSON.stringify({...details, note: ''}));
    window.localStorage.setItem(METHOD_KEY, activeMethod);
    try {
      const result = await placeOrder({data: {cart: lines, customer: details, pickupAt: activeSlot.at, method: activeMethod}});
      if (result.ok) {
        payingFor(result.orderId);
        return window.location.assign(result.redirectUrl);
      }
      setError(result.message);
      setEditing(true);
    } catch {
      setError('Could not reach the shop. Nothing was charged; check your connection and try again.');
    }
    submitting.current = false;
    setPlacing(false);
  }

  const problem = error ?? loadError?.message;

  return (
    <Shell>
      <Type role="head" as="h1">Checkout</Type>
      <div className={s.layout}>
        <aside className={s.summary} aria-labelledby="bag">
          <span className={s.stepHead}>
            <Type role="subhead" as="h2" id="bag" className={s.stepTitle}>Your order</Type>
            <Type role="body" ink="secondary" className={s.money}>{counted(itemCount, 'item', 'items')}</Type>
          </span>
          <ul className={s.lines}>
            {lines.map((line) => {
              const dish = orderableDish(storefront, line.dishId);
              if (!dish) return null;
              const photo = photoFor(dish.id);
              const priced = options?.cart.lines.find((l) => l.dishId === line.dishId);
              return (
                <li key={line.dishId} className={s.line} data-line={line.dishId}>
                  {photo ? <img src={photo} alt="" className={s.thumb} /> : <span className={s.thumb} aria-hidden />}
                  <span className={s.lineText}>
                    <Type role="body">{dish.name}</Type>
                    <Type role="body" className={s.money}>{priced ? formatRM(priced.unitSen * priced.quantity) : ' '}</Type>
                  </span>
                  <Stepper name={dish.name} quantity={line.quantity} onChange={(next) => (next === 0 ? remove(dish.id) : bag.set(dish.id, next))} />
                </li>
              );
            })}
          </ul>
          <AddOns lines={lines} />
          <OrderTotal totalSen={options?.cart.totalSen} />
          <Link href={storefront.menu.href}>Add more from the menu</Link>
        </aside>

        <form className={s.form} onSubmit={(event) => { event.preventDefault(); void pay(); }} noValidate>
          <Step n={1} id="when" title="Pick-up">
            <Type role="body" ink="secondary">
              At the counter, {storefront.address.slice(0, 2).join(', ')}.
              {limits ? ` ${list(limits.categories)} ${limits.categories.length === 1 ? 'is' : 'are'} served ${formatSpan(limits.span)}, so times stay inside those hours.` : ''}
            </Type>
            {options === null && !loadError ? <Type role="body">Finding times…</Type> : null}
            {options && slots.length === 0 ? (
              <Banner status="warning" title="No pick-up times left" description="Nothing in this bag can be ready before closing in the next few days. Try removing items with limited hours, or come back tomorrow." />
            ) : null}
            {days.length > 1 ? (
              <Choices
                legend="Day"
                name="day"
                look="chips"
                options={days.map(([date, day]) => ({value: date, label: day}))}
                value={activeSlot?.date}
                onChange={(date) => setSlot(slots.find((option) => option.date === date)?.at ?? null)}
              />
            ) : null}
            {times.length > 0 ? (
              <label className={s.select}>
                <Label ink="secondary">Time</Label>
                <select value={activeSlot?.at} onChange={(event) => setSlot(event.target.value)}>
                  {times.map((option) => (
                    <option key={option.at} value={option.at}>
                      {option.at === slots[0]?.at ? `${option.time}, earliest` : option.time}
                    </option>
                  ))}
                </select>
                <span className={s.chevron} aria-hidden />
              </label>
            ) : null}
          </Step>

          <Step
            n={2}
            id="who"
            title="Your details"
            aside={!editing ? <button type="button" className={s.textButton} onClick={() => setEditing(true)}><Label ink="blue">Edit</Label></button> : null}
          >
            {editing ? (
              <Stack gap="md">
                <TextInput label="Name" description="We call this name at the counter." value={details.name} onChange={update('name')} autoComplete="name" status={fieldStatus('name')} statusVariant="detached" isRequired />
                <TextInput label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" description="For example 012-345 6789." value={details.phone} onChange={update('phone')} status={fieldStatus('phone')} statusVariant="detached" isRequired />
                <TextInput label="Email" type="email" inputMode="email" autoComplete="email" hasAutoCorrect={false} description="For your receipt." value={details.email} onChange={update('email')} status={fieldStatus('email')} statusVariant="detached" isRequired />
              </Stack>
            ) : (
              <Field as="span" colour="cream-100" outlined={false} className={s.who}>
                <Type role="body">{details.name}</Type>
                <Type role="body" ink="secondary">{details.phone} · {details.email}</Type>
              </Field>
            )}
            <TextArea label="Note for the kitchen" value={details.note} onChange={update('note')} isOptional rows={2} maxLength={280} />
          </Step>

          <Step n={3} id="how" title="Payment">
            {options === null && !loadError ? <Type role="body">Loading ways to pay…</Type> : null}
            <Choices legend="Payment method" name="method" look="rows" options={choices} value={activeMethod} onChange={choose} />
            <Type role="caption" ink="secondary">You pay on our payment partner’s secure page, then come back here to follow your order.</Type>
          </Step>

          <div className={s.payBar}>
            {/* Rendered empty first, so a problem that appears in it is announced. */}
            <div role="alert">{problem ? <Banner status="error" title={problem} /> : null}</div>
            {loadError?.canRetry ? (
              <Cta onClick={retry}>Try again</Cta>
            ) : (
              <Cta type="submit" busy={placing} isDisabled={!options || slots.length === 0 || loadError !== null}>
                {placing ? 'Opening payment…' : options ? `Pay ${formatRM(options.cart.totalSen)}` : 'Pay'}
              </Cta>
            )}
            {activeSlot ? <Type role="caption" ink="secondary">Pick-up {activeSlot.day}, {activeSlot.time}</Type> : null}
          </div>
        </form>
      </div>
    </Shell>
  );
}

/** The total row under an order's lines. */
export function OrderTotal({totalSen}: {totalSen: number | undefined}) {
  return (
    <span className={s.total}>
      <Type role="subhead">Total</Type>
      <Type role="subhead" className={s.money}>{totalSen === undefined ? '' : formatRM(totalSen)}</Type>
    </span>
  );
}
