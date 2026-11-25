// The shop answers pages at one address. A browser keeps the bag, the last order, the staff
// sign-in and an installed app apart for each address, so a page asked for at www. or on
// workers.dev moves to the site's own address. Calls made by code are answered where they
// arrive: the payment and courier callbacks post to the address their order was placed at, and
// a tab still open on an old address calls its server functions there.

const answeredInPlace = ['/api/', '/_serverFn/'];

export function canonicalRedirect(request: Request, siteUrl: string): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const site = new URL(siteUrl);
  const www = url.hostname === `www.${site.hostname}`;
  if (!www && !url.hostname.endsWith('.workers.dev')) return null;
  if (answeredInPlace.some((prefix) => url.pathname.startsWith(prefix))) return null;
  // www. is the site for good. workers.dev stays a temporary move: browsers would keep a
  // permanent one, and that host also serves previews and a new shop before its domain is on.
  return Response.redirect(`${site.origin}${url.pathname}${url.search}`, www ? 301 : 302);
}

/** A path on this site, or the menu: for a query value anyone can write, so it never leads off-site. */
export const pathOnSite = (value: unknown): string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/menu';
