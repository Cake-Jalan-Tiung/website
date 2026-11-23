# Design system

How the brand is built in code: values, rules, theme, primitives and components, and the decisions behind them. For the site as a whole, see the [README](../README.md).

The brand from the Paper file "Cake Jalan Tiung" (pages Concept, Grammar and Mock up), built on [Astryx](https://astryx.atmeta.com) 0.7.17 with Vite and React 19. Where Paper disagrees with itself, the Grammar page wins.

```bash
pnpm install
pnpm dev        # TanStack Start on the Workers runtime: site at /, menu at /menu, design system at /design-system, worst case at /stress
pnpm db:migrate:local   # once, after copying .dev.vars.example to .dev.vars
pnpm test       # brand rules, order rules (prices, pick-up times, status moves) and the CHIP signature check
pnpm spec       # rendered components against Paper's measurements, in headless Chromium
pnpm fit        # every page at six widths; fails if anything overflows
pnpm export     # the social posts and the receipt header as PNGs at the size they are used, into exports/
python3 scripts/print-colours.py   # CMYK for coated stock and its error, into src/system/print.generated.ts
pnpm build
```

## How it is layered

Each layer reads only the ones above it.

1. **Values** (`src/system/tokens.ts`). Every brand value, written once: colours, the six type steps, spacing, the sheet scaffold, stroke weights, minimum sizes. The theme publishes them as `--cjt-*` custom properties, and the model, the marks generator and the specimen read the same objects. Nothing else in the repo states a brand colour, type step or spacing step; `components.module.css` holds only each component's own Paper measurements.
2. **Rules** (`src/system/model.ts`). The brand as data:
   - **Grounds and inks:** every surface the brand uses, and which text colour may sit on which (`legalText`). `pnpm test` checks every pair clears 4.5:1, every forbidden pair stays below it, and every contrast figure Paper prints.
   - **Law 04 engines:** `Stage` will not type-check an edible drawing on buttercream, and the marks registry is held to the same law by a test.
   - **Print** (`src/system/print.ts`): how each palette colour reaches paper. `scripts/print-colours.py` converts the printed colours to CMYK with Adobe's Coated FOGRA39 profile and measures each against the screen colour (CIEDE2000) into `print.generated.ts`; `print.ts` holds the choices made from those numbers. The Colour chapter prints them under the swatches.
3. **Theme** (`themes/cjt/`). Sets Astryx's own components to the brand through the theme editor: cobalt accent, true greys, white page, square corners, Jost, no shadows. `cjt.theme.ts` adds the tokens from layer 1 and nothing else. A test holds every colour in the editor's settings to `tokens.ts`.
4. **Primitives** (`src/system/`):
   - `Field` paints a flat field of one brand colour and tells what sits inside which ground it is on. Everything coloured is a `Field`.
   - `Type` sets one of the six steps. Its ink defaults to the ground's primary voice, and in development it logs an error for an ink that is illegal on its ground.
   - `Page`, `Sheet`, `Band`, `Bar`, `Marquee`, `Stack`, `Row`, `Columns` lay pages out on the brand's spacing steps. A page is full-width bands and gutter-held sheets, one under another. `Page` keeps the header, the bar and the sign-off outside `<main>`. `Bar` stays at the top on one line and the page keeps anchors clear of it. `Marquee` passes its content in a loop; it stops under the pointer, on a tap and from its own keyboard button, and under reduced motion it stands still and scrolls by hand.
   - `Stage` takes a `mark` to fill it at its drawn height; a stage grows for anything taller.
   - `ink="secondary"` on any text is the ground's receding voice: muted on paper, ink at 60% where muted fails, warm grey on ink.
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
| `Logo`, `TypesetWordmark`, `Tiung` | Size-aware and ground-aware marks (Grammar 04, 14). `Logo stacked` is the tall lockup; `TypesetWordmark mono` is ink only, for one-ink print |
| `BilingualLabel`, `StackedPair` | Grammar 15 middot pair and stacked pair |
| `MenuBoard`, `Price`, `PinkDot` | Mock up 03 menu board |
| `Artboard`, `ArtboardTile` | Ours: a piece drawn at a fixed size, and that piece shrunk to fit a chalk stage |

6. **Pages.** Built from layers 4 and 5; they hold no styling of their own beyond a few specimen-only measurements. Copy lives in `src/site/content.ts`, and no page states a brand line that is not in it or in Paper.
   - **The site** (routes `/` and `/menu` → `src/site/`) is an F&B storefront in English, laid out like a DTC food shop rather than the brand book: a passing line on ink, one slim sticky header (bird and wordmark, Menu, Best sellers, Visit, and Order now or the bag), a hero with the Google rating and two actions, four facts, the best sellers as cards with Add on each, photo tiles per category, the season's dish when there is one, the visit band (hours by day, address, phone, Google Maps, pick up or delivery), and a footer. The menu page is every category as hairline rows, each with Add. Pick-up orders are placed and paid on the site (`src/orders/`, plan in `docs/checkout-plan.md`): the bag lives in the browser, `/checkout` offers open pick-up times and payment methods, the payment provider is CHIP (or a local test page with `PAYMENTS=fake`), `/order/<id>` follows the order, and the kitchen works it on `/staff`. Delivery still links to the Beep store. Both pages compose `src/storefront/` (below) with the shop's content from `content.ts`.
   - **The design system** (route `/design-system` → `src/specimen/DesignSystem.tsx`) is laid out as a brand book: a cobalt cover, the statement beside the bird, nine chapters that each open with a display title and the brand's own line, the grounds as full-width fields named for the objects they came from, the menu board on ink, then the applications: packaging, social and the counter, each piece an `Artboard` at its drawn size. Inside the chapters the components keep Paper's measurements.
   - **The worst-case page** (route `/stress` → `src/specimen/Stress.tsx`) is dev only.
   - **The export page** (route `/export` → `Exports` in `src/specimen/Applications.tsx`) is dev only: each exportable piece unscaled, for `pnpm export` to photograph at its own scale (3× for social, 576 / 272 for the receipt header). It checks every PNG against the size the piece says it is used at.

**Storefront** (`src/storefront/`) is the reusable layer for F&B sites. `model.ts` is the shape of a shop (name, address, hours, announcements, nav, an order link per fulfilment, categories that hold their dishes, best sellers, the season's dish if any; `model.test.ts` holds the ids together); `sections.tsx` renders each section from that shape alone, through layers 4 and 5. Another client fills the same shape and brings its own brand layer (values, theme, marks); the sections still name this brand's marks and wordmark, so that layer is swapped with them.

**Marks** (`src/marks/marks.generated.tsx`) are 17 React components generated from the SVGs Paper exported (`assets/marks/`) by `scripts/build-marks.mjs`. Each brand colour reads a `--cjt-mark-*` slot before its token, so a mark can be recoloured, as the cream-on-cobalt logo is, without editing paths. Each registry entry names the ground Paper shows it on.

## The three checks

- **`pnpm spec`** holds 31 measurements copied from Paper's computed styles plus a check that Jost really loaded. Each row names its source sheet and layer and is checked on every matching element. It fails on a 1px difference. It proves those properties only; a full visual diff against Paper needs an export once Paper's limit resets.
- **`pnpm fit`** loads the home page, menu, checkout, kitchen screen, specimen and worst-case page at 320, 390, 768, 900, 1024 and 1440 wide. It fails if any element leaves the viewport, any box holds content wider than itself, or the console logs an error, which includes an illegal ink on a ground.
- **`pnpm test`** is the model: pairings, Law 04, the wordmark on every ground, and the theme's colours.

## Changing things

- A brand value: edit `src/system/tokens.ts`, then `pnpm exec astryx experimental theme compile themes/cjt/cjt.theme.ts`. A colour also needs `pnpm marks`, and a printed colour `python3 scripts/print-colours.py`.
- An Astryx dial or part: `pnpm exec astryx experimental theme editor set cjt <thing> <value>`, then `... editor show cjt --png` to look.
- A pairing: edit `legalText` in `model.ts`. The tests decide whether it is legal.
- A component measurement: change `components.module.css`, then the matching row in `scripts/spec-check.mjs` if Paper changed, then `pnpm spec`.
- A mark: re-export the SVG from Paper into `assets/marks/`, update its row in `scripts/build-marks.mjs`, run `pnpm marks`.
- An application: edit its entry in `src/specimen/Applications.tsx`, then `pnpm fit` (an artboard that clips its content fails it) and, for a social piece, `pnpm export`.
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
- **Sections open with the marker rule:** cobalt, at the 7px weight of a drawn contour. Grammar 05 gives every structural line to the Artline marker, and the weight is the marks' own.
- **Both pages' compositions are ours.** Paper has no page mock beyond the menu board, and its sheets are quiet grids. The pages use only system components, values and the brand's own lines, and get their scale from the drawings and the colour fields, because the type stops at 68px.
- **The cream at step 400 is `cream-400` everywhere,** the name Grammar 05 gives it. On ink the primary text colour is cream (Mock up 03), and on the cobalt awning only cream is legal, because that is all Paper sets on it.
- **Brand components are plain HTML and CSS modules, not Astryx primitives.** Astryx's layout components only take spacing in 4px steps up to 40px, and Paper's measurements (18, 22, 26, 28, 44, 56px) and scaffold (96, 128px) aren't on that grid. Astryx's doctor flags this as style warnings, which are deliberate here. Astryx's own components (Button, TextInput, Link and the rest) are themed and used as-is.
- **Status colours are Astryx's defaults.** Pandan, gula and ais are too pale to be visible as fills.
- **The cream-on-cobalt logo is a reconstruction** (colour slots swapped) until the shopfront's own artwork can be exported.
- **The applications are our compositions.** Paper's only mock exported so far is the menu board. Each piece applies the rules it names in its caption, takes every word it prints from `content.ts`, and draws nothing new: the tote is two rectangles and a strap loop, not a drawing. Bakes appear only on cream-100 inside a typed `Stage`, so Law 04 holds there as it does on the pages.
- **Print pieces are drawn at real size,** in mm, where a CSS px is 1/96 inch, so the six steps print at 0.75pt per px (label 8.25pt, body 11.25pt, display 51pt). The sizes are common stock sizes, chosen here, not quoted by a supplier: an 8-inch cake box (203mm), a 50mm square seal, one-inch (25mm) satin ribbon, a 90 × 54mm name card, an 80mm thermal roll printing 72mm, and a 380 × 420mm canvas tote with a 280mm strap drop.
- **Cobalt is printed as ink, never as a dyed material.** In CMYK on coated stock it lands 14 CIEDE2000 from the screen colour (about 2 is visible at a glance), so the kraft box and the tote take it as a spot ink mixed to its Lab target (31 62 −108, D50) and approved as a drawdown; the box is one ink because the lockup's cream is the board itself, and the tote is natural canvas so the ink, not a stock fabric, carries the colour. Digital pieces (seal, price card) fall back to CMYK and print duller, which their captions say. Pink is Pantone 2038 C, the nearest non-fluorescent match colorxs.com lists (ΔE 2.8 on screen); 812 C is nearer but is one of Pantone's neons, which fade. Text black is 100 K.
- **Social pieces are drawn at 360px wide and posted at 3×** (1080 × 1350 post, 1080 × 1920 story), so the six type steps hold at the size a phone shows them. The story keeps the top and bottom 250px clear, the margin third-party guides give for Instagram's own buttons; Meta's own figure was not checked.
- **The receipt follows the till.** An 80mm printer prints 576 dots across 72mm at 203 dpi (Epson's TM-T82 brochures) in one ink and sets the lines in its own font, so the brand's part is the header image (`pnpm export` writes it at 576 dots, no grey and no outline) and the words. The mock shows the lines in Jost for reading. The total line is Jumlah · Total, the Malay word for a sum before the English, as sheet 15 orders every pair; it is in `labels`, though not from Paper.

- **The storefront menu is the Beep menu,** copied with its names, descriptions, prices, sections and Best Seller list on 23 November 2026. It is not live: a change on Beep needs the same change in `content.ts`. The Paper menu (`menu`) stays for the design system's menu board, which draws the mock.
- **Photos are found by file name.** A file in `src/assets/photos/` named after a dish or category id (or `hero`, `shop`) shows wherever that id appears; `photos.ts` does the lookup and the folder's README lists the names. Media sit in fixed-ratio boxes (dishes 1:1, categories and the shop 4:3), so a grid holds its rhythm while photos arrive. For now every photo is Beep's own product photo, downloaded on 23 November 2026 at 800px and saved as JPEG (about 150 KB each); the hero and the category tiles borrow a dish's photo (`heroCover`, `cover`) until they have their own. Without a photo a dish shows its drawing (Shio Pan, Croissant, Butter Tteok, Latte, Long Black), otherwise the wordmark on cream-400; never a borrowed drawing.
- **The storefront is in English** at the owner's request. It does not use the Malay-first `labels` or "Habis bila habis", which the brand never translates; the design system keeps both.
- **Hours, phone and rating come from the Google Maps listing** "Cake Jalan Tiung Seksyen 4", read on 23 November 2026: 8am to 6pm, closed Thursdays; 4.2 from 704 reviews. The rating is linked to the listing and `storefront.proof` removes it everywhere. No review text is copied.
- **`Price` prints sen only when there are any:** 12, 16.50.
- **No season band** until the shop names a seasonal dish; `storefront.inSeason` turns it on.
- **The storefront is denser than the brand book:** its own header and section container, a 64px step between sections, no marker rules. `Sheet`, `Band` and `Bar` are unchanged for the design system.
- **No review quotes, press, FAQ or newsletter.** There is no real content for them yet, so they are not rendered.

## Not done yet

- The print colours are chosen from screen and profile numbers. Cobalt's spot ink and Pantone 2038 C still need a drawdown on the real kraft, satin and canvas before a run.

Paper's MCP weekly limit blocked the rest of the export (it resets around 28 November):
- the drawn flavour words and numerals, the four patterns, the awning's scalloped edge
- the Tiung flying and peeking poses
- whatever Mock up sheets come before 03. If they draw packaging or social pieces, those replace the compositions in the Applications chapter
- Grammar sheets 10–16, including the full bilingual vocabulary and size table. Rules the specimen quotes from them ("Six, and no more", the 320/96/32/16 bird ladder, the vocabulary list) came from truncated layer names and are provisional. `Tiung` implements only the 32px step, because the 96px and 16px drawings were never exported.

24 Astryx component states the theme doesn't reach (`editor show cjt`) keep Astryx's base look, for example the selected side-nav item and the disabled primary button. Status colours (info, success, warning, danger) are still Astryx's.

`Logo` chooses drawn or typeset from the width it is asked for, not the width it ends up at, so a drawn lockup squeezed below 180px by its container stays drawn.
