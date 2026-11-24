// Every link on the site, Astryx's included (through LinkProvider in the root route). A path on
// this site moves in place, through the router: no white flash, the header and the bag bar hold
// still while the page under them changes, and the page's code is fetched as soon as a finger
// or pointer lands on the link. Anything else (a phone number, Google Maps, Beep, a hash on this
// page, a new tab) is a plain link, left to the browser.
import type {AnchorHTMLAttributes, MouseEvent, Ref} from 'react';
import {useRouter} from '@tanstack/react-router';

/** Astryx passes `to` beside `href` for router links; this link reads `href` alone. */
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {ref?: Ref<HTMLAnchorElement>; to?: string};

const inSite = (href: string | undefined): href is string => href !== undefined && href.startsWith('/') && !href.startsWith('//');
const modified = (event: MouseEvent) => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

export function StoreLink({href, to: _to, target, download, onClick, onPointerEnter, onTouchStart, onFocus, ...rest}: Props) {
  const router = useRouter();
  if (!inSite(href) || target !== undefined || download !== undefined) {
    return <a {...rest} href={href} target={target} download={download} onClick={onClick} onPointerEnter={onPointerEnter} onTouchStart={onTouchStart} onFocus={onFocus} />;
  }
  // The type asks for `to`; the router reads `href` first and resolves it the way navigate does.
  const preload = () => void router.preloadRoute({to: '.', href}).catch(() => undefined);
  return (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || modified(event)) return;
        // A place on this same page (/#visit from home) is the browser's jump, focus and all.
        const url = new URL(href, window.location.href);
        if (url.hash && url.pathname === window.location.pathname) return;
        event.preventDefault();
        void router.navigate({href});
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preload();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        preload();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preload();
      }}
    />
  );
}
