# Cake Jalan Tiung design system

The brand from the Paper file "Cake Jalan Tiung" (pages Concept, Grammar and Mock up), built on [Astryx](https://astryx.atmeta.com) 0.7.17 with Vite and React 19. Where Paper disagrees with itself, the Grammar page wins.

```bash
pnpm install
pnpm dev        # design system at /design-system.html, site at /
pnpm test       # brand rules as unit tests (colour pairings, Law 04 types)
pnpm spec       # rendered components against Paper's measurements, in headless Chromium
pnpm build
```

## What's in it

**The theme** (`themes/cjt/`) sets Astryx's own components to the brand: cobalt accent, true greys, white page, square corners, Jost, no shadows, the six-step type scale. It also carries every brand value as a `--cjt-*` token: colours, the type scale, spacing, minimum sizes and stroke weights.

**The rules** (`src/system/model.ts`) hold the brand as data:
- **Grounds:** every surface the brand uses (paper, three creams, chalk, ink, the blue wash, five flavours).
- **Legal pairings:** which text colour may sit on which ground. `pnpm test` checks every pair clears 4.5:1, every forbidden pair stays below it, and every contrast figure Paper prints.
- **Law 04 engines:** `Stage` will not type-check an edible drawing on buttercream.
- **Minimum sizes:** below them, assets switch on their own. The logo turns typeset under 180px, and the bird turns into its icon at 32px and under.

**Brand components** (`src/system/components.tsx`, metrics in `components.module.css`):

| Component | From Paper |
| --- | --- |
| `Type`, `Label` | Grammar 04 six-step scale, in legal inks only |
| `PageHeader` | Concept masthead and statement |
| `SectionHeader` | Concept and Grammar section header: label, caption, rule-in-a-phrase, hairline |
| `TileCaption`, `Stage`, `Tile`, `MarkTile` | Concept tiles; Law 04 grounds per drawing |
| `Verdict` | Grammar Correct / Never example tiles |
| `RuleList` | Grammar 02 custody rows (Always / Never) |
| `ColourRoles`, `Swatch` | Grammar 05 roles; Concept palette |
| `FlavourCard` | Grammar 06 flavour cards |
| `Logo`, `TypesetWordmark`, `Tiung` | Size-aware marks (Grammar 04, 14) |
| `BilingualLabel`, `StackedPair` | Grammar 15 middot pair and stacked pair |
| `MenuBoard`, `Price`, `PinkDot`, `Rule` | Mock up 03 menu board |

**Marks** (`src/marks/marks.generated.tsx`) are 17 React components generated from the SVGs Paper exported (`assets/marks/`) by `scripts/build-marks.mjs`. Each colour reads a `--cjt-mark-*` slot before its brand token, so a mark can be recoloured, as the cream-on-cobalt logo is, without editing paths.

**The spec check** (`scripts/spec-check.mjs`) holds 31 measurements copied from Paper's computed styles plus a check that Jost really loaded. Each row names its source sheet and layer and is checked on every matching element (161 at last run), covering type sizes, header spacing, tile gaps, row padding, swatch sizes, the menu board, the typeset wordmark and the no-shadow rule. All 32 pass, and it fails on a 1px difference. It proves those properties only. A full visual diff against Paper needs an export once Paper's limit resets. The Grammar values were read by a helper agent and are recorded in the shared notes.

**The specimen** (`design-system.html`) documents every component on the Grammar sheet scaffold: 96px gutters, 1248 content, 128 between sections.

**The site** (`index.html` → `src/site/`) is built from the same components.

## Changing things

- A theme dial: `pnpm exec astryx experimental theme editor set cjt <thing> <value>`, then `... editor show cjt --png` to look.
- Brand tokens or component variants: edit `themes/cjt/cjt.theme.ts`, then `pnpm exec astryx experimental theme compile themes/cjt/cjt.theme.ts`.
- A component measurement: change `components.module.css`, then the matching row in `scripts/spec-check.mjs` if Paper changed, then `pnpm spec`.
- A mark: re-export the SVG from Paper into `assets/marks/`, update its row in `scripts/build-marks.mjs`, run `pnpm marks`.
- Before shipping: `pnpm test && pnpm spec && pnpm exec astryx doctor --built src`.

## Decisions

- **Light mode only.** Paper defines no dark palette; the reversed marks cover dark grounds.
- **Square corners and no shadows** (Grammar 05: "gradients, glows and drop shadows contradict the entire premise"). Pills such as switches keep `--radius-full`.
- **Jost everywhere,** loaded by the theme. Paper sheets set in system-ui were drift (Grammar 04 says so itself).
- **Type follows Grammar 04,** not the off-scale sizes some sheets use (20, 28, 32px). The one exception is the menu board, which matches Mock up 03 exactly (names 24/26 Medium −0.03em, descriptions 13/17), because the mock is the only drawing of it.
- **Astryx headings keep Astryx sizes** except h1 (40) and h3 (Subhead 24/28 Regular). Brand headings use `Type` (`head`, `display`), so dialog and drawer titles are not blown up to 40px. Display scales from 68px at 1440 wide down to 45px on phones.
- **Secondary text in Astryx components is `#6D6D6D`.** Astryx's contrast check refused `#767676` on its muted surfaces. Brand components keep `#767676`, and only on white. Where Paper set muted text on chalk (the Never tag), it is ink at 60% instead, which clears 4.5:1.
- **Brand components are plain HTML and CSS modules, not Astryx primitives.** Astryx's layout components only take spacing in 4px steps, and Paper's measurements (18, 22, 26, 28, 44, 56px) aren't on that grid. Astryx's doctor flags this as style warnings, which are deliberate here. Astryx's own components (Button, TextInput, Card and the rest) are themed and used as-is.
- **Status colours are Astryx's defaults.** Pandan, gula and ais are too pale to be visible as fills.
- **The cream-on-cobalt logo is a reconstruction** (colour slots swapped) until the shopfront's own artwork can be exported.

## Not done yet

Paper's MCP weekly limit blocked the rest of the export (it resets around 28 November):
- the drawn flavour words and numerals, the four patterns, the awning's scalloped edge
- the Tiung flying and peeking poses
- Grammar sheets 10–16, including the full bilingual vocabulary and size table. Rules the specimen quotes from them ("Six, and no more", the 320/96/32/16 bird ladder, the vocabulary list) came from truncated layer names and are provisional. `Tiung` implements only the 32px step, because the 96px and 16px drawings were never exported.

26 Astryx component states the theme doesn't reach (`editor show cjt`) keep Astryx's base look, for example the selected side-nav item and the disabled primary button.
