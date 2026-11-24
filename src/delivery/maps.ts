// Finding a delivery address in the browser: suggestions as the customer types, the street at a
// point (their location, or wherever they move the pin), and a map to move the pin on. Google's
// Maps JavaScript API in production; a stand-in list on a local build with no key. Only
// `location` and `formattedAddress` are ever fetched for a place: Google's cheapest fields.
import {importLibrary, setOptions} from '@googlemaps/js-api-loader';
import type {Maps} from '../orders/functions';
import {metresBetween, type Place} from './model';

export type Suggestion = {id: string; main: string; secondary: string};
export type Found = {address: string; place: Place};
export type MapHandle = {moveTo(place: Place): void; destroy(): void};

export interface AddressFinder {
  /** Up to five addresses for what has been typed, nearest the shop first. */
  suggest(input: string): Promise<Suggestion[]>;
  /** The chosen suggestion's street address and point; null when it has none. */
  resolve(id: string): Promise<Found | null>;
  /** The street address at a point, for a located or moved pin; null when there is none. */
  reverse(place: Place): Promise<string | null>;
  /** A map in `element` centred on `place`; `onSettle` hears the centre each time it comes to rest. Null when there is no map to draw. */
  mount(element: HTMLElement, place: Place, onSettle: (place: Place) => void): Promise<MapHandle | null>;
  /** The words the terms ask for wherever this finder's suggestions are shown. */
  attribution: string | null;
}

const toPlace = (location: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined): Place | null => {
  if (!location) return null;
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
  return {lat, lng};
};

/** Google keeps no business places on the map: only streets and buildings, so the pin is what reads. */
const QUIET_MAP: google.maps.MapTypeStyle[] = [
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
];

/** Results that name a door or a building beat ones that name only a road or an area. */
const PRECISE = ['street_address', 'premise', 'subpremise', 'establishment'];

let configuredKey: string | null = null;

function googleFinder(key: string, near: Place, radiusKm: number): AddressFinder {
  if (configuredKey === null) {
    setOptions({key, v: 'weekly', language: 'en', region: 'MY'});
    configuredKey = key;
  }
  const predictions = new Map<string, google.maps.places.PlacePrediction>();
  let session: google.maps.places.AutocompleteSessionToken | null = null;

  return {
    attribution: 'Google Maps',
    async suggest(input) {
      const {AutocompleteSuggestion, AutocompleteSessionToken} = await importLibrary('places');
      session ??= new AutocompleteSessionToken();
      const {suggestions} = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: session,
        includedRegionCodes: ['my'],
        origin: near,
        locationBias: {center: near, radius: Math.min(50_000, radiusKm * 1000 * 2)},
      });
      predictions.clear();
      return suggestions.flatMap(({placePrediction}) => {
        if (!placePrediction) return [];
        predictions.set(placePrediction.placeId, placePrediction);
        return [{id: placePrediction.placeId, main: placePrediction.mainText?.text ?? placePrediction.text.text, secondary: placePrediction.secondaryText?.text ?? ''}];
      }).slice(0, 5);
    },
    async resolve(id) {
      const prediction = predictions.get(id);
      if (!prediction) return null;
      const place = prediction.toPlace();
      await place.fetchFields({fields: ['location', 'formattedAddress']});
      // The session ends with this fetch; the next search starts a new one.
      session = null;
      const point = toPlace(place.location);
      return point && place.formattedAddress ? {address: place.formattedAddress, place: point} : null;
    },
    async reverse(point) {
      const {Geocoder} = await importLibrary('geocoding');
      const {results} = await new Geocoder().geocode({location: point, fulfillOnZeroResults: true});
      const best = results.find((result) => result.types.some((type) => PRECISE.includes(type))) ?? results[0];
      return best?.formatted_address ?? null;
    },
    async mount(element, point, onSettle) {
      const {Map} = await importLibrary('maps');
      const map = new Map(element, {
        center: point,
        zoom: 17,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        keyboardShortcuts: true,
        styles: QUIET_MAP,
      });
      const listener = map.addListener('idle', () => {
        const centre = toPlace(map.getCenter());
        if (centre) onSettle(centre);
      });
      return {
        moveTo: (next) => map.panTo(next),
        destroy: () => listener.remove(),
      };
    },
  };
}

/**
 * Made-up addresses around the shop for local work, one of them outside the area so the refusal
 * can be seen. Each names itself a test address; none is a real door.
 */
function fakeFinder(near: Place): AddressFinder {
  const kilometresNorth = (km: number): Place => ({lat: Math.round((near.lat + km / 111.32) * 1e6) / 1e6, lng: near.lng});
  const addresses = [
    {id: 'near', main: 'Test address A', secondary: 'Seksyen 7, Shah Alam (2 km)', place: kilometresNorth(2)},
    {id: 'mid', main: 'Test address B', secondary: 'Setia Alam (6 km)', place: kilometresNorth(6)},
    {id: 'far', main: 'Test address C', secondary: 'Rawang (40 km, outside the area)', place: kilometresNorth(40)},
  ];
  return {
    attribution: null,
    async suggest(input) {
      const words = input.trim().toLowerCase();
      return words.length === 0 ? [] : addresses.filter((a) => `${a.main} ${a.secondary} test`.toLowerCase().includes(words) || words.length >= 3).map(({id, main, secondary}) => ({id, main, secondary}));
    },
    async resolve(id) {
      const found = addresses.find((a) => a.id === id);
      return found ? {address: `${found.main}, ${found.secondary.replace(/ \(.*\)$/, '')}`, place: found.place} : null;
    },
    async reverse(point) {
      return `Test address, ${(metresBetween(near, point) / 1000).toFixed(1)} km from the shop`;
    },
    async mount() {
      return null;
    },
  };
}

export function addressFinder(maps: Maps, near: Place, radiusKm: number): AddressFinder {
  return maps.provider === 'google' ? googleFinder(maps.key, near, radiusKm) : fakeFinder(near);
}
