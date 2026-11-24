# Photos

Drop a photo here named after what it shows and the site picks it up: `shio-pan.jpg`
appears on the Shio Pan card and its menu row. JPG, PNG, WebP or AVIF; not HEIC.
Any size works. After adding or replacing one, run `pnpm photos`: it writes the widths the site
shows (400 and 800px, WebP) into `sized/`. `pnpm test` fails until you do.

- `hero` — the first screen
- `shop` — beside the opening hours
- Categories: `cakes`, `drinks`, `pastries`, `small-bites`, `breakfast`, `mains`
- Dishes: the `id` of each dish in `src/site/content.ts`, for example
  `london-to-shah-alam`, `shio-pan`, `dubai-chewy-cookie`, `butter-tteok`, `croissant`

The photos here now are stand-ins from the Beep store. A file with the same name replaces one;
`hero.jpg` or a category file such as `cakes.jpg` takes over from the dish photo it borrows.
