// Checkout on one page: the bag, a pick-up time, who collects it, how to pay, then Pay.
// Prices, times and payment methods come from the server for the bag as it stands.
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {storefront} from '../site/content';
import {textAt} from '../lib/guards';
import {AddToBag} from '../storefront/bag';
import {photoFor} from '../storefront/photos';
import {Sections, StoreHeader} from '../storefront/sections';
import {dishIndex} from '../storefront/model';
import {formatSpan} from '../storefront/hours';
import {Columns, Page, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {useBag, useBagReady} from './bag';
import {formatRM, type Customer} from './model';
import {getCheckoutOptions, placeOrder, type CheckoutOptions} from './functions';
import type {PaymentMethod} from '../payments/provider';
import s from './orders.module.css';

const DETAILS_KEY = 'cjt.customer.v1';
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

/** One tile per kind of payment: the card networks become a single Card. */
function paymentChoices(methods: readonly PaymentMethod[]) {
  const seen = new Set<string>();
  return methods.flatMap((method) => {
    const key = method.kind === 'other' ? method.id : method.kind;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{value: method.id, label: method.kind === 'card' ? 'Credit or debit card' : method.name}];
  });
}

/** A group of choices drawn as chips: native radios, so the keyboard and screen readers get a real group. */
function ChoiceChips({legend, name, options, value, onChange, grid}: {
  legend: string;
  name: string;
  options: readonly {value: string; label: string}[];
  value: string | undefined;
  onChange: (value: string) => void;
  grid?: boolean;
}) {
  return (
    <fieldset className={grid ? s.methods : s.chips}>
      <VisuallyHidden as="legend">{legend}</VisuallyHidden>
      {options.map((option) => (
        <label key={option.value} className={s.chip}>
          <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
          <Type role="body">{option.label}</Type>
        </label>
      ))}
    </fieldset>
  );
}

function Shell({children}: {children: ReactNode}) {
  return (
    <Page top={<StoreHeader store={storefront} />}>
      <Sections>{children}</Sections>
    </Page>
  );
}

export function Checkout() {
  const lines = useBag();
  const ready = useBagReady();
  const submitting = useRef(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [details, setDetails] = useState<Customer>(NO_DETAILS);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDetails(readDetails()), []);

  // `lines` is the bag store's own snapshot, so it changes identity only when the bag does.
  useEffect(() => {
    if (lines.length === 0) return;
    let live = true;
    getCheckoutOptions({data: {cart: lines}}).then(
      (result) => {
        if (!live) return;
        if (!result.ok) return setLoadError(result.message);
        setLoadError(null);
        setOptions(result);
      },
      () => live && setLoadError('Could not reach the shop. Check your connection and reload the page.'),
    );
    return () => {
      live = false;
    };
  }, [lines]);

  if (!ready) {
    return (
      <Shell>
        <Type role="display" as="h1">Checkout</Type>
      </Shell>
    );
  }

  if (lines.length === 0) {
    return (
      <Shell>
        <Stack gap="lg">
          <Type role="display" as="h1">Your bag is empty</Type>
          <Type role="body" as="p">Add something from the menu and it will wait here.</Type>
          <Button variant="primary" size="lg" label="See the menu" href={storefront.menu.href} />
        </Stack>
      </Shell>
    );
  }

  // The chosen time holds while it is still offered; otherwise the earliest is chosen.
  const slots = options?.slots ?? [];
  const activeSlot = slots.find((option) => option.at === slot) ?? slots[0];
  const days = [...new Map(slots.map((option) => [option.date, option.day])).entries()];
  const choices = paymentChoices(options?.methods ?? []);
  const activeMethod = choices.find((choice) => choice.value === method)?.value;
  const limits = options?.window;
  const update = (key: keyof Customer) => (value: string) => setDetails((was) => ({...was, [key]: value}));

  async function pay() {
    if (submitting.current) return;
    if (!activeSlot) return setError('Choose a pick-up time.');
    if (!activeMethod) return setError('Choose a way to pay.');
    submitting.current = true;
    setError(null);
    setPlacing(true);
    window.localStorage.setItem(DETAILS_KEY, JSON.stringify({...details, note: ''}));
    try {
      const result = await placeOrder({data: {cart: lines, customer: details, pickupAt: activeSlot.at, method: activeMethod}});
      if (result.ok) return window.location.assign(result.redirectUrl);
      setError(result.message);
    } catch {
      setError('Could not reach the shop. Nothing was charged; check your connection and try again.');
    }
    submitting.current = false;
    setPlacing(false);
  }

  return (
    <Shell>
      <Stack gap="lg">
        <Type role="display" as="h1">Checkout</Type>
        <Columns count={2} gap="xl" align="start">
          <form className={s.form} onSubmit={(event) => { event.preventDefault(); void pay(); }} noValidate>
            <section className={s.step} aria-labelledby="when">
              <Type role="subhead" as="h2" id="when">Pick-up time</Type>
              <Type role="body" ink="secondary">
                Collect at the counter: {storefront.address.join(', ')}.
                {limits ? ` ${limits.categories.join(' and ')} ${limits.categories.length === 1 ? 'is' : 'are'} served ${formatSpan(limits.span)}, so times stay inside those hours.` : ''}
              </Type>
              {options === null && !loadError ? <Type role="body">Finding times…</Type> : null}
              {options && slots.length === 0 ? (
                <Banner status="warning" title="No pick-up times left" description="Nothing in this bag can be ready before closing in the next few days. Try removing items with limited hours, or come back tomorrow." />
              ) : null}
              {days.length > 1 ? (
                <ChoiceChips
                  legend="Day"
                  name="day"
                  options={days.map(([date, day]) => ({value: date, label: day}))}
                  value={activeSlot?.date}
                  onChange={(date) => setSlot(slots.find((option) => option.date === date)?.at ?? null)}
                />
              ) : null}
              <ChoiceChips
                legend={`Time on ${activeSlot?.day ?? ''}`}
                name="slot"
                options={slots.filter((option) => option.date === activeSlot?.date).map((option) => ({
                  value: option.at,
                  label: option.at === slots[0]?.at ? `${option.time} (earliest)` : option.time,
                }))}
                value={activeSlot?.at}
                onChange={setSlot}
              />
            </section>

            <section className={s.step} aria-labelledby="who">
              <Type role="subhead" as="h2" id="who">Your details</Type>
              <Stack gap="md">
                <TextInput label="Name" description="We call this name at the counter." value={details.name} onChange={update('name')} isRequired />
                <TextInput label="Mobile number" type="tel" description="For example 012-345 6789." value={details.phone} onChange={update('phone')} isRequired />
                <TextInput label="Email" type="email" description="For your receipt." value={details.email} onChange={update('email')} isRequired />
                <TextArea label="Note for the kitchen" value={details.note} onChange={update('note')} isOptional rows={2} maxLength={280} />
              </Stack>
            </section>

            <section className={s.step} aria-labelledby="how">
              <Type role="subhead" as="h2" id="how">Payment</Type>
              <ChoiceChips legend="Payment method" name="method" options={choices} value={activeMethod} onChange={setMethod} grid />
            </section>

            <section className={s.step}>
              {error || loadError ? <Banner status="error" title={error ?? loadError ?? ''} /> : null}
              <Button type="submit" variant="primary" size="lg" width="100%" label={options ? `Pay ${formatRM(options.cart.totalSen)}` : 'Pay'} isLoading={placing} isDisabled={!options || slots.length === 0} />
              <Type role="caption" ink="secondary">
                You finish paying on our payment partner's page, then come back here to follow your order.
              </Type>
            </section>
          </form>

          <aside className={s.summary} aria-labelledby="bag">
            <Stack gap="sm">
              <Type role="subhead" as="h2" id="bag">Your order</Type>
              <ul className={s.lines}>
                {lines.map((line) => {
                  const dish = dishIndex(storefront).get(line.dishId);
                  if (!dish) return null;
                  const photo = photoFor(dish.id);
                  const priced = options?.cart.lines.find((l) => l.dishId === line.dishId);
                  return (
                    <li key={line.dishId} className={s.line}>
                      {photo ? <img src={photo} alt="" className={s.thumb} /> : <span className={s.thumb} aria-hidden />}
                      <span className={s.lineText}>
                        <Type role="body">{dish.name}</Type>
                        <AddToBag dish={dish} />
                      </span>
                      <Type role="body">{priced ? formatRM(priced.unitSen * priced.quantity) : ''}</Type>
                    </li>
                  );
                })}
              </ul>
              <OrderTotal totalSen={options?.cart.totalSen} />
              <Link href={storefront.menu.href}>Add more from the menu</Link>
            </Stack>
          </aside>
        </Columns>
      </Stack>
    </Shell>
  );
}

/** The total row under an order's lines. */
export function OrderTotal({totalSen}: {totalSen: number | undefined}) {
  return (
    <span className={s.total}>
      <Type role="subhead">Total</Type>
      <Type role="subhead">{totalSen === undefined ? '' : formatRM(totalSen)}</Type>
    </span>
  );
}
