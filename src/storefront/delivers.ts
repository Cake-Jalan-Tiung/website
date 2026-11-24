// Whether this deploy delivers, as the root route loaded it: the storefront then offers delivery on
// the site instead of pointing at the delivery platform, from the first paint.
import {useLoaderData} from '@tanstack/react-router';

export const useDelivers = (): boolean => useLoaderData({from: '__root__'});
