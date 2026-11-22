# Cake Jalan Tiung design system

The brand from the Paper file "Cake Jalan Tiung" (pages Concept, Grammar and Mock up), built on [Astryx](https://astryx.atmeta.com) 0.7.17 with Vite and React 19. Where Paper disagrees with itself, the Grammar page wins.

```bash
pnpm install
pnpm dev        # site at /, design system at /design-system.html, worst case at /stress.html
pnpm test       # brand rules as unit tests (colour pairings, Law 04, theme colours)
pnpm spec       # rendered components against Paper's measurements, in headless Chromium
pnpm fit        # all three pages at six widths; fails if anything overflows
pnpm build
```

## How it is layered

Each layer reads only the ones above it.

1. **Values** (`src/system/tokens.ts`). Every brand value, written once: colours, the six type steps, spacing, the sheet scaffold, stroke weights, minimum sizes. The theme publishes them as `--cjt-*` custom properties, and the model, the marks generator and the specimen read the same objects. Nothing else in the repo states a brand colour, type step or spacing step; `components.module.css` holds only each component's own Paper measurements.
2. **Rules** (`src/system/model.ts`). The brand as data:
   - **Grounds and inks:** every surface the brand uses, and which text colour may sit on which (`legalText`). `pnpm test` checks every pair clears 4.5:1, every forbidden pair stays below it, and every contrast figure Paper prints.
   - **Law 04 engines:** `Stage` will not type-check an edible drawing on buttercream, and the marks registry is held to the same law by a test.
3. **Theme** (`themes/cjt/`). Sets Astryx's own components to the brand through the theme editor: cobalt accent, true greys, white page, square corners, Jost, no shadows. `cjt.theme.ts` adds the tokens from layer 1 and nothing else. A test holds every colour in the editor's settings to `tokens.ts`.
4. **Primitives** (`src/system/`):
   - `Field` paints a flat field of one brand colour and tells what sits inside which ground it is on. Everything coloured is a `Field`.
   - `Type` sets one of the six steps. Its ink defaults to the ground's primary voice, and in development it logs an error for an ink that is illegal on its ground.
   - `Sheet`, `Band`, `Stack`, `Row`, `Columns` lay pages out on the brand's spacing steps.
5. **Brand components** (`src/system/components.tsx`, metrics in `components.module.css`):

| Component | From Paper |
| --- | --- |
| `Label` | Grammar 04 small capitals |
| `Statement`, `PageHeader` | Concept statement and masthead |
| `SectionHeader`, `Rule` | Concept and Grammar section header; the hairline and the ink rule |
| `Stage`, `Tile`, `MarkTile` | Concept tiles; Law 04 grounds per drawing |
| `Verdict` | Grammar Correct / Never example tiles |
| `RuleList` | Grammar 02 custody rows (Always / Never) |
| `ColourRoles`, `Swatch` | Grammar 05 roles; Concept palette |
| `FlavourCard` | Grammar 06 flavour cards |
| `Logo`, `TypesetWordmark`, `Tiung` | Size-aware and ground-aware marks (Grammar 04, 14) |
| `BilingualLabel`, `StackedPair` | Grammar 15 middot pair and stacked pair |
| `MenuBoard`, `Price`, `PinkDot` | Mock up 03 menu board |

6. **Pages.** The site (`index.html` → `src/site/`), the specimen (`design-system.html` → `src/specimen/DesignSystem.tsx`) and the worst-case page (`stress.html` → `src/specimen/Stress.tsx`, dev only) are built from layers 4 and 5 and hold no styling of their own beyond a few specimen-only measurements. Copy lives in `src/site/content.ts`.

**Marks** (`src/marks/marks.generated.tsx`) are 17 React components generated from the SVGs Paper exported (`assets/marks/`) by `scripts/build-marks.mjs`. Each brand colour reads a `--cjt-mark-*` slot before its token, so a mark can be recoloured, as the cream-on-cobalt logo is, without editing paths. Each registry entry names the ground Paper shows it on.

## The three checks

- **`pnpm spec`** holds 31 measurements copied from Paper's computed styles plus a check that Jost really loaded. Each row names its source sheet and layer and is checked on every matching element. It fails on a 1px difference. It proves those properties only; a full visual diff against Paper needs an export once Paper's limit resets.
- **`pnpm fit`** loads the site, the specimen and the worst-case page at 320, 390, 768, 900, 1024 and 1440 wide. It fails if any element leaves the viewport, any box holds content wider than itself, or the console logs an error, which includes an illegal ink on a ground.
- **`pnpm test`** is the model: pairings, Law 04, the wordmark on every ground, and the theme's colours.

## Changing things

- A brand value: edit `src/system/tokens.ts`, then `pnpm exec astryx experimental theme compile themes/cjt/cjt.theme.ts`. A colour also needs `pnpm marks`.
- An Astryx dial or part: `pnpm exec astryx experimental theme editor set cjt <thing> <value>`, then `... editor show cjt --png` to look.
- A pairing: edit `legalText` in `model.ts`. The tests decide whether it is legal.
- A component measurement: change `components.module.css`, then the matching row in `scripts/spec-check.mjs` if Paper changed, then `pnpm spec`.
- A mark: re-export the SVG from Paper into `assets/marks/`, update its row in `scripts/build-marks.mjs`, run `pnpm marks`.
- Before shipping: `pnpm test && pnpm spec && pnpm fit && pnpm exec astryx doctor --built src`.

## Decisions

- **Light mode only.** Paper defines no dark palette; the reversed marks cover dark grounds.
- **Square corners and no shadows** (Grammar 05: "gradients, glows and drop shadows contradict the entire premise"). Pills such as switches keep `--radius-full`.
- **Jost everywhere,** loaded by the theme. Paper sheets set in system-ui were drift (Grammar 04 says so itself).
- **Type follows Grammar 04,** not the off-scale sizes some sheets use (20, 28, 32px). The one exception is the menu board, which matches Mock up 03 exactly (names 24/26 Medium −0.03em, descriptions 13/17), because the mock is the only drawing of it.
- **Astryx headings keep Astryx sizes** except h1 (40) and h3 (Subhead 24/28 Regular). Brand headings use `Type` (`head`, `display`), so dialog and drawer titles are not blown up to 40px. Display scales from 68px at 1440 wide down to 45px on phones.
- **Secondary text in Astryx components is `#6D6D6D`.** Astryx's contrast check refused `#767676` on its muted surfaces. Brand components keep `#767676`, and only on white. Where Paper set muted text on chalk (the Never tag), it is ink at 60% instead, which clears 4.5:1.
- **Colour fields are `Field`, never an Astryx `Card` variant.** One way to paint a ground means one place that knows the ground, so text on it can be checked.
- **Astryx buttons follow Grammar 05.** "All link and button text" is cobalt, so secondary is a cobalt hairline with cobalt text and ghost is cobalt text. Primary is cream on cobalt, as on the awning. Paper drew no buttons; these are the roles applied, not a copy of a drawing.
- **The site's composition is ours.** Paper has no page mock beyond the menu board. The site uses only system components and values: the cobalt awning, a cream-100 hero band, an ink rule over each section's stacked pair, the board beside the six objects, the mascot beside the hours.
- **The cream at step 400 is `cream-400` everywhere,** the name Grammar 05 gives it. On ink the primary text colour is cream (Mock up 03), and on the cobalt awning only cream is legal, because that is all Paper sets on it.
- **Brand components are plain HTML and CSS modules, not Astryx primitives.** Astryx's layout components only take spacing in 4px steps up to 40px, and Paper's measurements (18, 22, 26, 28, 44, 56px) and scaffold (96, 128px) aren't on that grid. Astryx's doctor flags this as style warnings, which are deliberate here. Astryx's own components (Button, TextInput, Link and the rest) are themed and used as-is.
- **Status colours are Astryx's defaults.** Pandan, gula and ais are too pale to be visible as fills.
- **The cream-on-cobalt logo is a reconstruction** (colour slots swapped) until the shopfront's own artwork can be exported.

## Not done yet

Paper's MCP weekly limit blocked the rest of the export (it resets around 28 November):
- the drawn flavour words and numerals, the four patterns, the awning's scalloped edge
- the Tiung flying and peeking poses
- Grammar sheets 10–16, including the full bilingual vocabulary and size table. Rules the specimen quotes from them ("Six, and no more", the 320/96/32/16 bird ladder, the vocabulary list) came from truncated layer names and are provisional. `Tiung` implements only the 32px step, because the 96px and 16px drawings were never exported.

24 Astryx component states the theme doesn't reach (`editor show cjt`) keep Astryx's base look, for example the selected side-nav item and the disabled primary button. Status colours (info, success, warning, danger) are still Astryx's.

`Logo` chooses drawn or typeset from the width it is asked for, not the width it ends up at, so a drawn lockup squeezed below 180px by its container stays drawn.
