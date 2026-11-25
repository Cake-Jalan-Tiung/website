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
  const online = useOnline();
  useEffect(() => console.error(error), [error]);
  return (
    <Unreachable
      title={online ? 'This page didn’t load' : 'You’re offline'}
      line={online ? 'Try again in a moment.' : 'Check your connection, then try again.'}
      retry={() => void router.invalidate()}
    />
  );
}

/**
 * Where the service worker sends a page it has not kept when the network failed to bring it.
 * That failure is the evidence, so the page says offline whatever `navigator.onLine` claims;
 * Try again asks for the page afresh.
 */
export function OfflinePage({from}: {from: string}) {
  return <Unreachable title="You’re offline" line="Check your connection, then try again. The menu still opens while you wait." retry={() => window.location.assign(from)} />;
}

function Unreachable({title, line, retry}: {title: string; line: string; retry: () => void}) {
  return (
    <Sections>
      <Stack gap="lg">
        <Stack gap="sm">
          <Type role="display" as="h1">{title}</Type>
          <Type role="body" as="p">{line}</Type>
        </Stack>
        <Cta onClick={retry}>Try again</Cta>
        <Link href="/menu">See the menu</Link>
      </Stack>
    </Sections>
  );
}

const useOnline = () => useSyncExternalStore(onConnectionChange, () => navigator.onLine, () => true);

function onConnectionChange(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}
