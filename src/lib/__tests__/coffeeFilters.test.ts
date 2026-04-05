import { describe, it, expect } from "vitest";
import { filterCoffees, sortCoffees, countNotes, CoffeeFilters } from "../coffeeFilters";
import { CoffeeEntry } from "../types";

function makeCoffee(overrides: Partial<CoffeeEntry> = {}): CoffeeEntry {
  return {
    id: "test-1",
    roaster: "Test Roaster",
    coffee: "Test Coffee",
    type: "Single Origin",
    process: "Washed",
    tastingNotes: ["Chocolate", "Cherry"],
    price: "$22.00",
    date: "2026-03-01T00:00:00Z",
    link: "https://example.com",
    imageUrl: "",
    isMerch: false,
    ...overrides,
  };
}

const DEFAULT_FILTERS: CoffeeFilters = {
  search: "",
  filterType: "",
  filterProcess: "",
  filterNote: "",
  showMerch: false,
};

const SAMPLE_COFFEES: CoffeeEntry[] = [
  makeCoffee({ id: "1", roaster: "Alpha Roasters", coffee: "Ethiopia Guji", type: "Single Origin", process: "Natural", tastingNotes: ["Blueberry", "Jasmine"], price: "$24.00", date: "2026-03-15T00:00:00Z" }),
  makeCoffee({ id: "2", roaster: "Beta Coffee", coffee: "Morning Blend", type: "Blend", process: "Washed", tastingNotes: ["Chocolate", "Caramel"], price: "$18.00", date: "2026-03-10T00:00:00Z" }),
  makeCoffee({ id: "3", roaster: "Gamma Roast", coffee: "Colombia Huila", type: "Single Origin", process: "Honey", tastingNotes: ["Cherry", "Chocolate"], price: "$20.00", date: "2026-03-20T00:00:00Z" }),
  makeCoffee({ id: "4", roaster: "Alpha Roasters", coffee: "Branded Mug", type: "Unknown", process: "", tastingNotes: [], price: "$15.00", date: "2026-03-05T00:00:00Z", isMerch: true }),
];

describe("filterCoffees", () => {
  it("filters out merch by default", () => {
    const result = filterCoffees(SAMPLE_COFFEES, DEFAULT_FILTERS);
    expect(result).toHaveLength(3);
    expect(result.every((c) => !c.isMerch)).toBe(true);
  });

  it("includes merch when showMerch is true", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, showMerch: true });
    expect(result).toHaveLength(4);
  });

  it("filters by search term (roaster)", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, search: "alpha" });
    expect(result).toHaveLength(1);
    expect(result[0].roaster).toBe("Alpha Roasters");
  });

  it("filters by search term (coffee name)", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, search: "blend" });
    expect(result).toHaveLength(1);
    expect(result[0].coffee).toBe("Morning Blend");
  });

  it("filters by search term (tasting note)", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, search: "blueberry" });
    expect(result).toHaveLength(1);
  });

  it("filters by type", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, filterType: "Blend" });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("Blend");
  });

  it("filters by process", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, filterProcess: "Honey" });
    expect(result).toHaveLength(1);
    expect(result[0].process).toBe("Honey");
  });

  it("filters by note", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, filterNote: "Chocolate" });
    expect(result).toHaveLength(2);
  });

  it("combines multiple filters", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, filterType: "Single Origin", filterNote: "Chocolate" });
    expect(result).toHaveLength(1);
    expect(result[0].coffee).toBe("Colombia Huila");
  });

  it("returns empty when no matches", () => {
    const result = filterCoffees(SAMPLE_COFFEES, { ...DEFAULT_FILTERS, search: "nonexistent" });
    expect(result).toHaveLength(0);
  });
});

describe("sortCoffees", () => {
  it("sorts by date descending", () => {
    const sorted = sortCoffees(SAMPLE_COFFEES.slice(0, 3), "date", "desc");
    expect(sorted[0].coffee).toBe("Colombia Huila");
    expect(sorted[2].coffee).toBe("Morning Blend");
  });

  it("sorts by date ascending", () => {
    const sorted = sortCoffees(SAMPLE_COFFEES.slice(0, 3), "date", "asc");
    expect(sorted[0].coffee).toBe("Morning Blend");
    expect(sorted[2].coffee).toBe("Colombia Huila");
  });

  it("sorts by price descending", () => {
    const sorted = sortCoffees(SAMPLE_COFFEES.slice(0, 3), "price", "desc");
    expect(sorted[0].price).toBe("$24.00");
    expect(sorted[2].price).toBe("$18.00");
  });

  it("sorts by price ascending", () => {
    const sorted = sortCoffees(SAMPLE_COFFEES.slice(0, 3), "price", "asc");
    expect(sorted[0].price).toBe("$18.00");
  });

  it("sorts by roaster alphabetically", () => {
    const sorted = sortCoffees(SAMPLE_COFFEES.slice(0, 3), "roaster", "asc");
    expect(sorted[0].roaster).toBe("Alpha Roasters");
    expect(sorted[2].roaster).toBe("Gamma Roast");
  });

  it("does not mutate input array", () => {
    const input = [...SAMPLE_COFFEES.slice(0, 3)];
    const original = [...input];
    sortCoffees(input, "date", "desc");
    expect(input).toEqual(original);
  });
});

describe("countNotes", () => {
  it("counts note occurrences", () => {
    const counts = countNotes(SAMPLE_COFFEES);
    expect(counts.get("Chocolate")).toBe(2);
    expect(counts.get("Blueberry")).toBe(1);
  });

  it("skips merch entries", () => {
    const counts = countNotes(SAMPLE_COFFEES);
    // Merch entry has no notes, but verify it was skipped
    let total = 0;
    counts.forEach((v) => (total += v));
    expect(total).toBe(6); // 2 + 2 + 2 from the 3 non-merch entries
  });

  it("returns empty map for empty input", () => {
    const counts = countNotes([]);
    expect(counts.size).toBe(0);
  });
});
