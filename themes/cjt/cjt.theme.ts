// The cjt theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in cjt.settings.json and the generated cjt.settings.ts;
// change them with `astryx experimental theme editor set cjt ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {cjtSettings} from './cjt.settings';
import {cssTokens} from '../../src/system/tokens';

// Brand values come from src/system/tokens.ts, the one place they are written down.
// Astryx semantic tokens (accent, text, border, surfaces, type scale) are set through
// the editor settings; `cssTokens` are the brand values Astryx has no semantic slot for.
export const cjtTheme = defineTheme({
  extends: cjtSettings,
  name: 'cjt',
  localTokens: cssTokens,
});
