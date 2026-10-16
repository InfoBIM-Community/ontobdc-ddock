const COOKIE_PREFIX = 'infobim-access-token-';

/** How long a remembered token is used before the browser drops it. */
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 3600;

/** The token belongs to the server it was given for, not to one project address. */
const cookieName = (url: string): string => `${COOKIE_PREFIX}${encodeURIComponent(new URL(url).origin)}`;

/**
 * Remembers the bearer token of a remote server in a cookie, so a reload can
 * use it while it is still valid. The browser drops the cookie when it expires.
 * The cookie is readable by this page's scripts: it is no safer than any other
 * storage the page can read.
 */
export class AccessTokenRepository {
  constructor(private readonly cookies: { cookie: string } = document) {}

  get(url: string): string | undefined {
    const prefix = `${cookieName(url)}=`;
    const entry = this.cookies.cookie.split('; ').find((part) => part.startsWith(prefix));
    return entry ? decodeURIComponent(entry.slice(prefix.length)) || undefined : undefined;
  }

  set(url: string, token: string, maxAgeSeconds: number = ACCESS_TOKEN_MAX_AGE_SECONDS): void {
    this.cookies.cookie =
      `${cookieName(url)}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Strict; Secure`;
  }

  forget(url: string): void {
    this.cookies.cookie = `${cookieName(url)}=; Max-Age=0; Path=/; SameSite=Strict; Secure`;
  }
}
