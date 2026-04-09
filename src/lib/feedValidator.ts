import { parseFeed } from "./feedParser";
import { isMerchandise } from "./heuristics";
import { FEED_TIMEOUT_MS } from "./constants";
import { logger } from "./logger";

export type ValidationReason =
  | "ok"
  | "fetch_failed"
  | "http_error"
  | "empty_body"
  | "not_feed"
  | "no_entries"
  | "merch_only";

export interface FeedValidationResult {
  ok: boolean;
  reason: ValidationReason;
  status?: number;
  entryCount: number;
  coffeeEntryCount: number;
  looksLikeCoffee: boolean;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "CoffeeRadar/1.0",
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml, text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    logger.warn("feedValidator: fetch failed", { url, err });
    return null;
  }
}

/**
 * Deeply validate a feed URL: confirm it returns a parseable feed with at
 * least one non-merch coffee entry. Used by the failed-feed rescan flow to
 * decide whether a suggested replacement is worth offering to the admin.
 */
export async function validateFeedUrl(url: string): Promise<FeedValidationResult> {
  const base: Omit<FeedValidationResult, "ok" | "reason"> = {
    entryCount: 0,
    coffeeEntryCount: 0,
    looksLikeCoffee: false,
  };

  const res = await fetchWithTimeout(url);
  if (!res) return { ...base, ok: false, reason: "fetch_failed" };
  if (!res.ok) return { ...base, ok: false, reason: "http_error", status: res.status };

  const body = (await res.text()).trim();
  if (!body) return { ...base, ok: false, reason: "empty_body", status: res.status };

  const sample = body.slice(0, 5000).toLowerCase();
  if (!sample.includes("<rss") && !sample.includes("<feed") && !sample.includes("<rdf")) {
    return { ...base, ok: false, reason: "not_feed", status: res.status };
  }

  const entries = parseFeed(body, "validator", url);
  if (entries.length === 0) {
    return { ...base, ok: false, reason: "no_entries", status: res.status };
  }

  const coffeeEntries = entries.filter((e) => !e.isMerch && !isMerchandise(e.coffee, "", []));
  const looksLikeCoffee = coffeeEntries.length > 0;

  if (!looksLikeCoffee) {
    return {
      ...base,
      ok: false,
      reason: "merch_only",
      status: res.status,
      entryCount: entries.length,
      coffeeEntryCount: 0,
    };
  }

  return {
    ok: true,
    reason: "ok",
    status: res.status,
    entryCount: entries.length,
    coffeeEntryCount: coffeeEntries.length,
    looksLikeCoffee: true,
  };
}
