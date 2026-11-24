// The delivery address at checkout: the customer's location or a search finds the street, a map
// whose centre is the pin settles the door, and two short fields say what no map knows. Nothing
// is priced until they press Deliver here, so moving the pin costs one street look-up, not a quote.
import {useEffect, useMemo, useRef, useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Typeahead} from '@astryxdesign/core/Typeahead';
import type {SearchSource} from '@astryxdesign/core/Typeahead';
import {Field} from '../system/Field';
import {Stack} from '../system/layout';
import {Type} from '../system/Type';
import type {DeliveryOffer} from '../orders/functions';
import {addressFinder, type MapHandle} from './maps';
import {NOTE_MAX, UNIT_MAX, dropOffProblems, metresBetween, parseDropOff, type DropOff, type DropOffField, type Place} from './model';
import s from './delivery.module.css';

/** An address being found: the street and pin may still be missing. */
export type Draft = {address: string; unit: string; note: string; place: Place | null};
export const EMPTY_DRAFT: Draft = {address: '', unit: '', note: '', place: null};

type Item = {id: string; label: string; main: string; secondary: string};
type Locating = 'idle' | 'locating' | 'denied' | 'failed';

/** A pin moved less than this is the map settling where it was put, not the customer moving it. */
const SETTLED_METRES = 3;

const LOCATING_PROBLEM: Partial<Record<Locating, string>> = {
  denied: 'Your location is turned off for this site. Search for your address instead.',
  failed: 'Couldn’t find your location. Search for your address instead.',
};

export function DeliveryAddress({offer, initial, onConfirm}: {offer: DeliveryOffer; initial: Draft; onConfirm: (dropOff: DropOff) => void}) {
  // Keyed on values, not on the offer's objects, which checkout receives anew whenever the bag changes:
  // a new finder would redraw the map and restart Google's search session.
  const mapsKey = offer.maps.provider === 'google' ? offer.maps.key : '';
  const {lat, lng} = offer.from;
  const finder = useMemo(
    () => addressFinder(mapsKey ? {provider: 'google', key: mapsKey} : {provider: 'fake'}, {lat, lng}, offer.radiusKm),
    [mapsKey, lat, lng, offer.radiusKm],
  );
  const [draft, setDraft] = useState<Draft>(initial);
  const [chosen, setChosen] = useState<Item | null>(null);
  const [locating, setLocating] = useState<Locating>('idle');
  const [lookingUp, setLookingUp] = useState(false);
  const [checked, setChecked] = useState(false);
  const mapElement = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapHandle | null>(null);
  const [hasMap, setHasMap] = useState<boolean | null>(null);
  // The pin as last placed by code, so the map settling there is not taken for a move.
  const placed = useRef<Place | null>(initial.place);

  const source = useMemo<SearchSource<Item>>(
    () => ({
      search: async (query) => (await finder.suggest(query)).map((found) => ({...found, label: [found.main, found.secondary].filter(Boolean).join(', ')})),
      bootstrap: () => [],
    }),
    [finder],
  );

  /** The street at a pin the customer put down; the pin stays even if the street is not found. */
  const lookUp = (place: Place) => {
    setLookingUp(true);
    finder.reverse(place).then(
      (address) => setDraft((was) => (was.place === place ? {...was, address: address ?? was.address} : was)),
      () => undefined,
    ).finally(() => setLookingUp(false));
  };

  const putPin = (place: Place, address: string | null) => {
    placed.current = place;
    setDraft((was) => ({...was, place, address: address ?? was.address}));
    map.current?.moveTo(place);
  };

  // The map appears with the first pin and follows the customer's moves from then on.
  const hasPlace = draft.place !== null;
  useEffect(() => {
    const element = mapElement.current;
    const start = placed.current;
    if (!hasPlace || !element || !start) return;
    let live = true;
    let handle: MapHandle | null = null;
    finder.mount(element, start, (centre) => {
      if (placed.current && metresBetween(placed.current, centre) < SETTLED_METRES) return;
      placed.current = centre;
      setDraft((was) => ({...was, place: centre}));
      lookUp(centre);
    }).then(
      (mounted) => {
        if (!live) return mounted?.destroy();
        handle = mounted;
        map.current = mounted;
        setHasMap(mounted !== null);
      },
      () => live && setHasMap(false),
    );
    return () => {
      live = false;
      handle?.destroy();
      map.current = null;
    };
    // Drawn once per finder; lookUp only uses state setters.
  }, [hasPlace, finder]);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return setLocating('failed');
    setLocating('locating');
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        const place = {lat: coords.latitude, lng: coords.longitude};
        setLocating('idle');
        setChosen(null);
        putPin(place, null);
        lookUp(place);
      },
      (error) => setLocating(error.code === error.PERMISSION_DENIED ? 'denied' : 'failed'),
      {enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000},
    );
  };

  const choose = (item: Item | null) => {
    setChosen(item);
    if (!item) return;
    void finder.resolve(item.id).then((found) => {
      if (found) putPin(found.place, found.address);
    });
  };

  const problems = checked ? dropOffProblems(draft) : {};
  const status = (key: DropOffField) => (problems[key] ? {type: 'error' as const, message: problems[key]} : undefined);
  const confirm = () => {
    setChecked(true);
    if (Object.keys(dropOffProblems(draft)).length > 0) return;
    onConfirm(parseDropOff(draft, (message) => new Error(message)));
  };
  const locatingProblem = LOCATING_PROBLEM[locating];

  return (
    <Stack gap="md">
      <span className={s.find}>
        <Button variant="secondary" size="lg" label={locating === 'locating' ? 'Finding you…' : 'Use my location'} isLoading={locating === 'locating'} onClick={useMyLocation} />
        <Typeahead
          label="Or search for your address"
          placeholder="Street, building or taman"
          searchSource={source}
          value={chosen}
          onChange={choose}
          minQueryLength={3}
          debounceMs={250}
          maxMenuItems={5}
          emptySearchText="No address found. Try the street name."
          renderItem={(item) => (
            <span className={s.suggestion}>
              <Type role="body">{item.main}</Type>
              {item.secondary ? <Type role="caption" ink="secondary">{item.secondary}</Type> : null}
            </span>
          )}
          status={problems.address && !draft.place ? {type: 'error', message: problems.address} : undefined}
          statusVariant="detached"
          width="100%"
        />
        {finder.attribution ? (
          <Type role="caption" ink="secondary">
            Addresses from <span translate="no">{finder.attribution}</span>
          </Type>
        ) : null}
      </span>
      {locatingProblem ? <Banner status="warning" title={locatingProblem} /> : null}

      {draft.place ? (
        <Stack gap="sm">
          <div className={s.map} data-map={hasMap === false ? 'none' : undefined}>
            <div ref={mapElement} className={s.mapCanvas} />
            {hasMap === false ? (
              <Field as="span" colour="cream-100" outlined={false} className={s.noMap}>
                <Type role="caption" ink="secondary">No map on this build: the pin is at {draft.place.lat.toFixed(5)}, {draft.place.lng.toFixed(5)}.</Type>
              </Field>
            ) : (
              <span className={s.pin} aria-hidden />
            )}
          </div>
          {hasMap ? <Type role="caption" ink="secondary">Move the map until the pin is on your door.</Type> : null}
          <Type role="body" aria-live="polite">{lookingUp ? 'Finding the street…' : draft.address || 'Move the pin onto your street.'}</Type>
        </Stack>
      ) : null}

      {draft.place ? (
        <Stack gap="md">
          <TextInput
            label="House, unit or floor"
            description="The rider needs this to find your door."
            value={draft.unit}
            onChange={(unit) => setDraft((was) => ({...was, unit: unit.slice(0, UNIT_MAX)}))}
            autoComplete="address-line2"
            status={status('unit')}
            statusVariant="detached"
            isRequired
          />
          <TextInput
            label="Note for the rider"
            description="A gate, a guard house, a landmark."
            value={draft.note}
            onChange={(note) => setDraft((was) => ({...was, note: note.slice(0, NOTE_MAX)}))}
            isOptional
          />
          <Button variant="primary" size="lg" label="Deliver here" isDisabled={lookingUp} onClick={confirm} />
        </Stack>
      ) : null}
    </Stack>
  );
}
