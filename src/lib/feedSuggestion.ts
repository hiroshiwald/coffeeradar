import { FeedSource } from "./types";
import { discoverFeedFromStoreUrl } from "./feedDiscovery";
import { validateFeedUrl, FeedValidationResult } from "./feedValidator";
import { logger } from "./logger";

export interface FeedSuggestion {
  sourceUrl: string;
  name: string;
  currentValidation: FeedValidationResult;
  candidate?: {
    feedUrl: string;
    website: string;
    method?: string;
  };
  preflight?: FeedValidationResult;
  reason?: string;
}

function parentOrigin(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * For a known-failing feed, try to discover a replacement feed from the
 * roaster's website (and the feed URL's own origin as a fallback), then
 * pre-flight the candidate with a real feed validation. Only returns a
 * candidate whose preflight passes, so the admin only ever sees actionable
 * suggestions.
 */
export async function suggestReplacementFeed(source: FeedSource): Promise<FeedSuggestion> {
  const currentValidation = await validateFeedUrl(source.url);

  const basis: FeedSuggestion = {
    sourceUrl: source.url,
    name: source.name,
    currentValidation,
  };

  if (currentValidation.ok) {
    return { ...basis, reason: "current_feed_still_valid" };
  }

  const candidateOrigins = new Set<string>();
  if (source.website) candidateOrigins.add(source.website);
  const feedOrigin = parentOrigin(source.url);
  if (feedOrigin) candidateOrigins.add(feedOrigin);

  for (const origin of candidateOrigins) {
    try {
      const discovery = await discoverFeedFromStoreUrl(origin);
      if (!discovery.ok || !discovery.feedUrl) continue;
      if (discovery.feedUrl === source.url) continue;

      const preflight = await validateFeedUrl(discovery.feedUrl);
      if (preflight.ok) {
        return {
          ...basis,
          candidate: {
            feedUrl: discovery.feedUrl,
            website: discovery.website,
            method: discovery.method,
          },
          preflight,
        };
      }
    } catch (err) {
      logger.warn("feedSuggestion: discovery failed", { origin, err });
    }
  }

  // TODO: plug in a web-search step here (e.g. "<roaster> coffee atom feed")
  // for cases where origin-based discovery finds nothing.
  return { ...basis, reason: "no_candidate_found" };
}

export async function suggestReplacementsForFailed(
  sources: FeedSource[],
  concurrency = 5,
): Promise<FeedSuggestion[]> {
  const out: FeedSuggestion[] = [];
  for (let i = 0; i < sources.length; i += concurrency) {
    const batch = sources.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(suggestReplacementFeed));
    out.push(...results);
  }
  return out;
}
