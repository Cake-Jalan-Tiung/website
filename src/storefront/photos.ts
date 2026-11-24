// Photos are found by file name: drop `<id>.jpg` (or .jpeg, .png, .webp, .avif) into
// src/assets/photos and it appears wherever that id is shown. Ids are the dish and category
// ids in content.ts, plus `hero` and `shop`. `pnpm photos` writes each as WebP into sized/,
// named `<id>-<width>.webp`, and an img offers every width to the browser, which fetches the
// smallest that is sharp at its size; photos.test.ts fails while a photo has not been sized.
const originals = import.meta.glob<string>('../assets/photos/*.{jpg,jpeg,png,webp,avif}', {eager: true, import: 'default', query: '?url'});
const sized = import.meta.glob<string>('../assets/photos/sized/*.webp', {eager: true, import: 'default', query: '?url'});

/** A photo as an img takes it: the largest as `src`, every width in `srcSet`. */
export type Photo = {src: string; srcSet?: string};

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

const widthsById = new Map<string, {width: number; url: string}[]>();
for (const [path, url] of Object.entries(sized)) {
  const match = /^(.+)-(\d+)\.webp$/.exec(fileName(path));
  if (!match) continue;
  const [, id, width] = match;
  widthsById.set(id, [...(widthsById.get(id) ?? []), {width: Number(width), url}].sort((a, b) => a.width - b.width));
}

const byId = new Map(
  Object.entries(originals).map(([path, original]) => {
    const file = fileName(path);
    const id = file.slice(0, file.lastIndexOf('.')).toLowerCase();
    const widths = widthsById.get(id) ?? [];
    // A photo dropped in and not yet sized still shows, at its original size.
    const photo: Photo = widths.length === 0 ? {src: original} : {src: widths[widths.length - 1].url, srcSet: widths.map(({width, url}) => `${url} ${width}w`).join(', ')};
    return [id, photo] as const;
  }),
);

/** The first of these ids that has a photo: the slot's own, then its stand-ins. */
export function photoFor(...ids: ReadonlyArray<string | undefined>): Photo | undefined {
  for (const id of ids) {
    const photo = id === undefined ? undefined : byId.get(id);
    if (photo) return photo;
  }
  return undefined;
}
