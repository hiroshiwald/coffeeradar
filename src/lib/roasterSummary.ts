import { CoffeeEntry, FeedSource } from "./types";
import { sortCoffees } from "./coffeeFilters";

export interface RoasterSummary {
  url: string;
  name: string;
  website: string;
  count: number;
  coffees: CoffeeEntry[];
}

function joinKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Groups coffees under the sources that produced them.
 *
 * The only link between the two types is that `CoffeeEntry.roaster` holds a copy
 * of `FeedSource.name`, so the join is on the normalized name. Output carries
 * `url` because two sources can share a name (the same roaster registered with
 * two feed URLs); `url` is unique and is what callers should use for keys and
 * selection state.
 */
export function summarizeRoasters(
  sources: FeedSource[],
  coffees: CoffeeEntry[],
): RoasterSummary[] {
  const byRoaster = new Map<string, CoffeeEntry[]>();
  for (const c of coffees) {
    if (c.isMerch) continue;
    const key = joinKey(c.roaster);
    const bucket = byRoaster.get(key);
    if (bucket) bucket.push(c);
    else byRoaster.set(key, [c]);
  }

  return sources
    .map((s) => {
      const matched = byRoaster.get(joinKey(s.name)) ?? [];
      return {
        url: s.url,
        name: s.name,
        website: s.website,
        count: matched.length,
        coffees: sortCoffees(matched, "date", "desc"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/**
 * Number of roasters with at least one coffee.
 *
 * No date arithmetic here on purpose. The pipeline already drops anything older
 * than 30 days in two places (`fetchAllFeeds` and `getCoffees`), so every coffee
 * that reaches this module is already inside that window.
 */
export function countActive(summaries: RoasterSummary[]): number {
  return summaries.filter((s) => s.count > 0).length;
}

/** Uppercase first character, or "#" for anything that is not a letter. */
export function groupLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

export interface RoasterLetterGroup {
  letter: string;
  roasters: RoasterSummary[];
}

/**
 * Splits an already name-sorted list into A-Z blocks.
 *
 * Relies on the input order from `summarizeRoasters`, so it appends rather than
 * sorting again. Only letters that have entries appear in the output.
 */
export function groupByLetter(summaries: RoasterSummary[]): RoasterLetterGroup[] {
  const groups: RoasterLetterGroup[] = [];
  for (const summary of summaries) {
    const letter = groupLetter(summary.name);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.roasters.push(summary);
    else groups.push({ letter, roasters: [summary] });
  }
  return groups;
}
