// Photos are found by file name: drop `<id>.jpg` (or .jpeg, .png, .webp, .avif) into
// src/assets/photos and it appears wherever that id is shown. Ids are the dish and category
// ids in content.ts, plus `hero` and `shop`. Vite fingerprints and serves each file.
const files = import.meta.glob<string>('../assets/photos/*.{jpg,jpeg,png,webp,avif}', {eager: true, import: 'default', query: '?url'});

const byId = new Map(
  Object.entries(files).map(([path, url]) => {
    const file = path.slice(path.lastIndexOf('/') + 1);
    return [file.slice(0, file.lastIndexOf('.')).toLowerCase(), url] as const;
  }),
);

/** The first of these ids that has a photo: the slot's own, then its stand-ins. */
export function photoFor(...ids: ReadonlyArray<string | undefined>): string | undefined {
  for (const id of ids) {
    const url = id === undefined ? undefined : byId.get(id);
    if (url) return url;
  }
  return undefined;
}
