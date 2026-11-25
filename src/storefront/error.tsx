import {useEffect, useSyncExternalStore} from 'react';
import {useRouter, type ErrorComponentProps} from '@tanstack/react-router';
import {Link} from '@astryxdesign/core/Link';
import {Stack} from '../system/layout';
import {Type} from '../system/Type';
import {Cta} from './bag';
import {Sections} from './sections';

/**
 * Every page's error, from a loader that failed or a page that threw. An installed app has no
 * reload or back button, so the page offers both ways on.
 */
export function ErrorPage({error}: ErrorComponentProps) {
  const router = useRouter();
  const online = useSyncExternalStore(onConnectionChange, () => navigator.onLine, () => true);
  useEffect(() => console.error(error), [error]);
  return (
    <Sections>
      <Stack gap="lg">
        <Stack gap="sm">
          <Type role="display" as="h1">{online ? 'This page didn’t load' : 'You’re offline'}</Type>
          <Type role="body" as="p">{online ? 'Try again in a moment.' : 'Check your connection, then try again.'}</Type>
        </Stack>
        <Cta onClick={() => void router.invalidate()}>Try again</Cta>
        <Link href="/menu">See the menu</Link>
      </Stack>
    </Sections>
  );
}

function onConnectionChange(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}
