import {StrictMode, type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../index.css';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug, themeModes} from '../astryx-themes';

export function render(Page: ComponentType) {
  const root = document.getElementById('root');
  if (!root) throw new Error('index.html is missing #root');
  createRoot(root).render(
    <StrictMode>
      <Theme theme={themes[defaultThemeSlug]} mode={themeModes[defaultThemeSlug]}>
        <Page />
      </Theme>
    </StrictMode>,
  );
}
