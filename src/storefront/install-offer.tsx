// Offers to install the shop, in the way this browser allows (./install.ts). On iOS there is no
// prompt, so the offer is the two steps, each with the glyph the browser shows for it.
import {useState, type SVGProps} from 'react';
import {Icon} from '@astryxdesign/core/Icon';
import {Stack} from '../system/layout';
import {Type} from '../system/Type';
import {install, useInstallWay} from './install';
import s from './storefront.module.css';

/** Share, as iOS draws it: a tray with an arrow leaving it. */
function ShareGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

/** Add to Home Screen, as iOS draws it: a plus in a rounded square. */
function AddGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

// Icon draws its glyph as a block; here it sits in the sentence, on the text's baseline.
const inLine = {display: 'inline-block', verticalAlign: '-0.2em'} as const;

/** The two steps on iOS, for inside a line of text. */
export function InstallSteps() {
  return (
    <>
      Open Share <Icon icon={ShareGlyph} size="sm" style={inLine} /> in your browser, then choose Add to Home Screen <Icon icon={AddGlyph} size="sm" style={inLine} />.
    </>
  );
}

/** The footer's way to install, there on every page for whoever passed the order page's offer by. */
export function InstallEntry() {
  const way = useInstallWay();
  const [open, setOpen] = useState(false);
  if (way === 'prompt') {
    return (
      <button type="button" className={`${s.plainLink} ${s.plainButton}`} onClick={() => void install()}>
        <Type role="body">Install the app</Type>
      </button>
    );
  }
  if (way !== 'ios') return null;
  return (
    <Stack gap="xs">
      <button type="button" className={`${s.plainLink} ${s.plainButton}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Type role="body">Add to your home screen</Type>
      </button>
      {open ? (
        <Type role="caption" ink="secondary">
          <InstallSteps />
        </Type>
      ) : null}
    </Stack>
  );
}
