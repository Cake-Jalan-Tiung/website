import {StrictMode, useEffect, type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../index.css';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug, themeModes} from '../astryx-themes';

/**
 * The page is drawn after the browser has looked for the URL's #fragment, so a link into
 * another page (the menu's categories) would land at the top. Once drawn, go to it.
 */
function ScrollToFragment() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}

export function render(Page: ComponentType) {
  const root = document.getElementById('root');
  if (!root) throw new Error('index.html is missing #root');
  createRoot(root).render(
    <StrictMode>
      <Theme theme={themes[defaultThemeSlug]} mode={themeModes[defaultThemeSlug]}>
        <Page />
        <ScrollToFragment />
      </Theme>
    </StrictMode>,
  );
}
