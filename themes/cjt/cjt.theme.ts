// The cjt theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in cjt.settings.json and the generated cjt.settings.ts;
// change them with `astryx experimental theme editor set cjt ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {cjtSettings} from './cjt.settings';

// Brand values from the Paper file "Cake Jalan Tiung", page Concept. Astryx semantic
// tokens (accent, text, border, surfaces, type scale) are set through the editor
// settings; these are the brand values Astryx has no semantic slot for.
export const cjtTheme = defineTheme({
  extends: cjtSettings,
  name: 'cjt',
  localTokens: {
    '--cjt-color-ink': '#111111',
    '--cjt-color-muted': '#767676',
    '--cjt-color-rule': '#E4E4E4',
    '--cjt-color-paper': '#FFFFFF',
    '--cjt-color-blue': '#031CFE',
    '--cjt-color-blue-50': '#EFF1FF',
    '--cjt-color-blue-100': '#DADEFF',
    '--cjt-color-blue-200': '#B7BFFF',
    '--cjt-color-pink': '#F75D9A',
    '--cjt-color-cream': '#FAE0AF',
    '--cjt-color-cream-100': '#FEF6E6',
    '--cjt-color-cream-200': '#FFF6E0',
    '--cjt-color-chalk': '#F4F4F2',
    '--cjt-color-pandan': '#5FE0A4',
    '--cjt-color-gula': '#FFC24D',
    '--cjt-color-ais': '#4FDDDD',
    '--cjt-color-ube': '#CDBCFF',
    '--cjt-color-teh': '#FFB08A',
    '--cjt-color-rule-reversed': '#4A4136',

    // Grammar sheet 04: the six-step Jost scale, exactly.
    '--cjt-text-label': '0.6875rem',
    '--cjt-text-caption': '0.8125rem',
    '--cjt-text-body': '0.9375rem',
    '--cjt-text-subhead': '1.5rem',
    '--cjt-text-head': '2.5rem',
    '--cjt-text-display': '4.25rem',
    '--cjt-leading-label': '0.875rem',
    '--cjt-leading-caption': '1rem',
    '--cjt-leading-body': '1.5rem',
    '--cjt-leading-subhead': '1.75rem',
    '--cjt-leading-head': '2.625rem',
    '--cjt-leading-display': '4.375rem',
    '--cjt-weight-regular': '400',
    '--cjt-weight-medium': '500',
    '--cjt-tracking-caps': '0.18em',
    '--cjt-tracking-caps-wide': '0.2em',
    '--cjt-tracking-tight': '-0.03em',
    '--cjt-measure': '520px',

    '--cjt-space-xs': '8px',
    '--cjt-space-sm': '16px',
    '--cjt-space-md': '24px',
    '--cjt-space-lg': '40px',
    '--cjt-space-xl': '64px',
    '--cjt-space-2xl': '96px',
    '--cjt-space-3xl': '128px',
    '--cjt-space-gutter': '96px',
    '--cjt-space-section': '128px',
    '--cjt-container-tile': '400px',
    '--cjt-container-content': '1248px',
    '--cjt-container-sheet': '1440px',

    '--cjt-stroke-contour': '7px',
    '--cjt-stroke-limb': '5px',
    '--cjt-stroke-texture': '3.5px',

    // Secondary text and hairlines on ink, from the Mock up menu board.
    '--cjt-color-ink-muted': '#9A9082',

    // Grammar sheets 04 and 14: below these sizes an asset switches to its fallback.
    '--cjt-min-wordmark-drawn': '180px',
    '--cjt-min-lockup-crowned': '240px',
    '--cjt-min-object': '64px',
    '--cjt-min-pink-accent': '40px',
  },
  components: {
    // Flat colour stages the marks sit on in Paper: no border, no shadow.
    card: {
      'variant:cream': {backgroundColor: 'var(--cjt-color-cream)', borderColor: 'transparent'},
      'variant:cream-light': {backgroundColor: 'var(--cjt-color-cream-100)', borderColor: 'transparent'},
      'variant:chalk': {backgroundColor: 'var(--cjt-color-chalk)', borderColor: 'transparent'},
      'variant:ink': {backgroundColor: 'var(--cjt-color-ink)', borderColor: 'transparent', color: 'var(--cjt-color-paper)'},
      // Grammar sheet 06: one flavour per surface, as a ground only; text stays ink.
      'variant:pandan': {backgroundColor: 'var(--cjt-color-pandan)', borderColor: 'transparent', color: 'var(--cjt-color-ink)'},
      'variant:gula': {backgroundColor: 'var(--cjt-color-gula)', borderColor: 'transparent', color: 'var(--cjt-color-ink)'},
      'variant:ais': {backgroundColor: 'var(--cjt-color-ais)', borderColor: 'transparent', color: 'var(--cjt-color-ink)'},
      'variant:ube': {backgroundColor: 'var(--cjt-color-ube)', borderColor: 'transparent', color: 'var(--cjt-color-ink)'},
      'variant:teh': {backgroundColor: 'var(--cjt-color-teh)', borderColor: 'transparent', color: 'var(--cjt-color-ink)'},
    },
  },
});
