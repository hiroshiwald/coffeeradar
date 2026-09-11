import { describe, it, expect } from "vitest";
import { summarizeRoasters, countActive, groupLetter, groupByLetter } from "../roasterSummary";
import { CoffeeEntry, FeedSource } from "../types";

function makeCoffee(overrides: Partial<CoffeeEntry> = {}): CoffeeEntry {
  return {
    id: "test-1",
    roaster: "Alpha Roasters",
    coffee: "Test Coffee",
    type: "Single Origin",
    process: "Washed",
    tastingNotes: ["Chocolate"],
    price: "$22.00",
    date: "2026-03-01T00:00:00Z",
    link: "https://example.com/p/1",
    imageUrl: "",
    isMerch: false,
    ...overrides,
  };
}

function makeSource(overrides: Partial<FeedSource> = {}): FeedSource {
  return {
    name: "Alpha Roasters",
    url: "https://alpha.example/feed.atom",
    website: "https://alpha.example",
    ...overrides,
  };
}

describe("summarizeRoasters", () => {
  it("counts every coffee for a roaster", () => {
    const result = summarizeRoasters(
      [makeSource()],
      [makeCoffee({ id: "1" }), makeCoffee({ id: "2" })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].coffees).toHaveLength(2);
  });

  it("skips merch", () => {
    const result = summarizeRoasters(
      [makeSource()],
      [makeCoffee({ id: "1" }), makeCoffee({ id: "2", coffee: "Branded Mug", isMerch: true })],
    );
    expect(result[0].count).toBe(1);
    expect(result[0].coffees[0].coffee).toBe("Test Coffee");
  });

  it("gives a roaster with no coffees count 0 and an empty array", () => {
    const result = summarizeRoasters([makeSource({ name: "Quiet Roasters" })], [makeCoffee()]);
    expect(result[0].count).toBe(0);
    expect(result[0].coffees).toEqual([]);
  });

  it("joins on the normalized name so a case-only rename still matches", () => {
    const result = summarizeRoasters(
      [makeSource({ name: "Sey Coffee" })],
      [makeCoffee({ roaster: "  SEY COFFEE  " })],
    );
    expect(result[0].count).toBe(1);
  });

  it("sorts coffees newest first", () => {
    const result = summarizeRoasters(
      [makeSource()],
      [
        makeCoffee({ id: "old", date: "2026-03-01T00:00:00Z" }),
        makeCoffee({ id: "new", date: "2026-03-20T00:00:00Z" }),
        makeCoffee({ id: "mid", date: "2026-03-10T00:00:00Z" }),
      ],
    );
    expect(result[0].coffees.map((c) => c.id)).toEqual(["new", "mid", "old"]);
  });

  it("sorts output by name, ignoring case", () => {
    const result = summarizeRoasters(
      [
        makeSource({ name: "zebra coffee", url: "https://z.example/f" }),
        makeSource({ name: "Alpha Roasters", url: "https://a.example/f" }),
        makeSource({ name: "MIDDLE COFFEE", url: "https://m.example/f" }),
      ],
      [],
    );
    expect(result.map((r) => r.name)).toEqual(["Alpha Roasters", "MIDDLE COFFEE", "zebra coffee"]);
  });

  it("keeps two sources that share a name as separate entries with distinct urls", () => {
    const result = summarizeRoasters(
      [
        makeSource({ name: "Blueprint Coffee", url: "https://blueprintcoffee.com/store/feed/atom/" }),
        makeSource({ name: "Blueprint Coffee", url: "https://blueprintcoffee.com/feed/?post_type=product" }),
      ],
      [makeCoffee({ roaster: "Blueprint Coffee" })],
    );
    expect(result).toHaveLength(2);
    expect(new Set(result.map((r) => r.url)).size).toBe(2);
  });

  it("returns an empty list for no sources", () => {
    expect(summarizeRoasters([], [makeCoffee()])).toEqual([]);
  });

  it("does not mutate the coffees it is given", () => {
    const coffees = [
      makeCoffee({ id: "old", date: "2026-03-01T00:00:00Z" }),
      makeCoffee({ id: "new", date: "2026-03-20T00:00:00Z" }),
    ];
    summarizeRoasters([makeSource()], coffees);
    expect(coffees.map((c) => c.id)).toEqual(["old", "new"]);
  });
});

describe("countActive", () => {
  it("counts only roasters with at least one coffee", () => {
    const summaries = summarizeRoasters(
      [
        makeSource({ name: "Alpha Roasters", url: "https://a.example/f" }),
        makeSource({ name: "Quiet Roasters", url: "https://q.example/f" }),
      ],
      [makeCoffee({ roaster: "Alpha Roasters" })],
    );
    expect(countActive(summaries)).toBe(1);
  });

  it("is 0 when nothing matched", () => {
    expect(countActive(summarizeRoasters([makeSource()], []))).toBe(0);
  });
});

describe("groupLetter", () => {
  it("uppercases the first letter", () => {
    expect(groupLetter("anchorhead Coffee")).toBe("A");
    expect(groupLetter("Sey Coffee")).toBe("S");
  });

  it("ignores leading whitespace", () => {
    expect(groupLetter("  luna")).toBe("L");
  });

  it("groups non-letters under #", () => {
    expect(groupLetter("1000 Faces Coffee")).toBe("#");
    expect(groupLetter("49th Parallel Coffee Roasters")).toBe("#");
  });

  it("groups an empty name under #", () => {
    expect(groupLetter("")).toBe("#");
  });
});

describe("groupByLetter", () => {
  function summaries(names: string[]) {
    return summarizeRoasters(
      names.map((name, i) => makeSource({ name, url: `https://s${i}.example/f` })),
      [],
    );
  }

  it("puts each letter in its own block, in input order", () => {
    const groups = groupByLetter(summaries(["Alpha", "Anchorhead", "Beta"]));
    expect(groups.map((g) => g.letter)).toEqual(["A", "B"]);
    expect(groups[0].roasters.map((r) => r.name)).toEqual(["Alpha", "Anchorhead"]);
  });

  it("groups case variants under one letter", () => {
    const groups = groupByLetter(summaries(["sunday coffee project", "SUMP COFFEE"]));
    expect(groups).toHaveLength(1);
    expect(groups[0].letter).toBe("S");
    expect(groups[0].roasters).toHaveLength(2);
  });

  it("collects numeric names under #", () => {
    const groups = groupByLetter(summaries(["1000 Faces Coffee", "49th Parallel", "Alpha"]));
    expect(groups.map((g) => g.letter)).toEqual(["#", "A"]);
    expect(groups[0].roasters).toHaveLength(2);
  });

  it("returns an empty list for no summaries", () => {
    expect(groupByLetter([])).toEqual([]);
  });
});
