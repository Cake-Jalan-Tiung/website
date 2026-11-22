// Types for the module `astryx theme add` generates as plain JS (src/astryx-themes.js).
// Keep the slugs in step with that file when a theme is added or removed.
import type {DefinedTheme} from '@astryxdesign/core/theme';

export type ThemeSlug = 'cjt';
export declare const themes: Record<ThemeSlug, DefinedTheme>;
export declare const defaultThemeSlug: ThemeSlug;
export declare const themeModes: Record<ThemeSlug, 'light' | 'dark' | 'system'>;
