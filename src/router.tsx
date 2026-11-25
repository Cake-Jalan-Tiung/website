import {createRouter} from '@tanstack/react-router';
import {routeTree} from './routeTree.gen';
import {ErrorPage} from './storefront/error';

export function getRouter() {
  return createRouter({routeTree, scrollRestoration: true, defaultPreload: 'intent', defaultViewTransition: true, scrollRestorationBehavior: 'instant', defaultHashScrollIntoView: {behavior: 'instant'}, defaultErrorComponent: ErrorPage});
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
