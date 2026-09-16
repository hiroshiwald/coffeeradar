import { getTipUrl } from "./tipUrl";

/** Owner-controlled state of the tip link. `url` is stored raw; rendering is gated by getTipUrl(). */
export interface TipLinkSettings {
  enabled: boolean;
  url: string;
}

// Bound on the stored URL: long enough for any tip page, short enough that a
// pasted blob cannot fill the settings row.
export const TIP_URL_MAX_LENGTH = 2048;

export type TipLinkValidation =
  | { ok: true; settings: TipLinkSettings }
  | { ok: false; error: string };

/**
 * The single gate for every tip link on the site.
 *
 * The toggle decides first, then getTipUrl(). Callers render nothing when this
 * returns null and never re-check the protocol themselves.
 */
export function resolveTipUrl(settings: TipLinkSettings): string | null {
  if (!settings.enabled) return null;
  return getTipUrl(settings.url);
}

/** Validates an untrusted POST body from /api/admin/tip-link. */
export function validateTipLinkInput(body: unknown): TipLinkValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const { enabled, url } = body as Record<string, unknown>;
  if (typeof enabled !== "boolean") {
    return { ok: false, error: "enabled must be a boolean." };
  }
  if (typeof url !== "string") {
    return { ok: false, error: "url must be a string." };
  }

  const trimmed = url.trim();
  if (trimmed.length > TIP_URL_MAX_LENGTH) {
    return { ok: false, error: `url must be ${TIP_URL_MAX_LENGTH} characters or fewer.` };
  }
  // Turning it on with a URL that cannot render would look saved but show
  // nothing, so reject it here instead of storing a dead setting.
  if (enabled && !getTipUrl(trimmed)) {
    return { ok: false, error: "The tip link needs an https URL before it can be turned on." };
  }

  return { ok: true, settings: { enabled, url: trimmed } };
}
