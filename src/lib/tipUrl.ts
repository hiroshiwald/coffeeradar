/**
 * Validates a tip URL supplied through the environment.
 *
 * Returns the URL only when it parses and uses https. Anything else returns
 * null so the caller renders nothing. The catch is a validated rejection of an
 * unparseable value, not a swallowed error: `new URL()` throws on any string it
 * cannot parse, and "cannot parse" is exactly the case we want to reject.
 */
export function getTipUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}
