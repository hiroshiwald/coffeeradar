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

/**
 * A-Z block a name belongs to, or "#" for anything that does not start with a
 * letter.
 *
 * Diacritics are stripped first so "Ambar" and "Ámbar" land in the same block.
 * Without that they diverge: localeCompare with sensitivity "base" sorts them
 * together, but an accented initial is not in /A-Z/ and would be grouped under
 * "#". The test is anchored because uppercasing one character can yield two
 * ("ß" becomes "SS"), and only the first is the block.
 */
export function groupLetter(name: string): string {
  const first = name
    .trim()
    .charAt(0)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .charAt(0);
  return /^[A-Z]$/.test(first) ? first : "#";
}

export interface RoasterLetterGroup {
  letter: string;
  roasters: RoasterSummary[];
}

/**
 * Splits a name-sorted list into A-Z blocks, at most one block per letter.
 *
 * Keyed by letter rather than by comparing against the previous entry. Appending
 * only when the letter changes would emit a second block for the same letter
 * whenever sort order and block order disagree, and each block's letter is both
 * a React key and a DOM id that the letter nav links to, so a repeat is a
 * duplicate key and an ambiguous anchor. Blocks come out in first-seen order,
 * which is the caller's sort order.
 */
export function groupByLetter(summaries: RoasterSummary[]): RoasterLetterGroup[] {
  const groups = new Map<string, RoasterLetterGroup>();
  for (const summary of summaries) {
    const letter = groupLetter(summary.name);
    const group = groups.get(letter);
    if (group) group.roasters.push(summary);
    else groups.set(letter, { letter, roasters: [summary] });
  }
  return [...groups.values()];
}
