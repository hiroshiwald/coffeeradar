import { describe, it, expect } from "vitest";
import { detectType, detectProcess, extractNotes, extractPrice, isMerchandise } from "../heuristics";

describe("detectType", () => {
  it("detects blend", () => {
    expect(detectType("Morning Blend")).toBe("Blend");
  });

  it("detects single origin by keyword", () => {
    expect(detectType("Single Origin Ethiopia")).toBe("Single Origin");
  });

  it("detects single origin by country name", () => {
    expect(detectType("Ethiopia Yirgacheffe")).toBe("Single Origin");
    expect(detectType("Colombia Huila")).toBe("Single Origin");
    expect(detectType("Kenya Nyeri AA")).toBe("Single Origin");
  });

  it("detects single origin by region name", () => {
    expect(detectType("Guji Natural")).toBe("Single Origin");
    expect(detectType("Huehuetenango Lot 5")).toBe("Single Origin");
  });

  it("is case insensitive", () => {
    expect(detectType("BLEND OF THE WEEK")).toBe("Blend");
    expect(detectType("ETHIOPIA WASHED")).toBe("Single Origin");
  });

  it("returns Unknown when no match", () => {
    expect(detectType("Mysterious Coffee")).toBe("Unknown");
    expect(detectType("")).toBe("Unknown");
  });

  it("blend takes priority over origin", () => {
    expect(detectType("Ethiopia Colombia Blend")).toBe("Blend");
  });
});

describe("detectProcess", () => {
  it("detects washed", () => {
    expect(detectProcess("Fully washed process")).toBe("Washed");
    expect(detectProcess("Washed")).toBe("Washed");
  });

  it("detects natural", () => {
    expect(detectProcess("Natural process")).toBe("Natural");
  });

  it("detects honey variants", () => {
    expect(detectProcess("Yellow Honey")).toBe("Yellow Honey");
    expect(detectProcess("Red Honey")).toBe("Red Honey");
    expect(detectProcess("Black Honey")).toBe("Black Honey");
    expect(detectProcess("Honey process")).toBe("Honey");
    expect(detectProcess("Honey")).toBe("Honey");
  });

  it("detects anaerobic variants", () => {
    expect(detectProcess("Anaerobic Natural")).toBe("Anaerobic Natural");
    expect(detectProcess("Anaerobic Fermentation")).toBe("Anaerobic");
  });

  it("detects co-ferment", () => {
    expect(detectProcess("Co-ferment")).toBe("Co-Ferment");
    expect(detectProcess("Carbonic Maceration")).toBe("Co-Ferment");
  });

  it("detects wet hulled", () => {
    expect(detectProcess("Wet-hull process")).toBe("Wet Hulled");
    expect(detectProcess("wet hull")).toBe("Wet Hulled");
  });

  it("returns empty string when no match", () => {
    expect(detectProcess("Some random text")).toBe("");
    expect(detectProcess("")).toBe("");
  });

  it("respects priority order (anaerobic natural before natural)", () => {
    expect(detectProcess("anaerobic natural")).toBe("Anaerobic Natural");
  });
});

describe("extractNotes", () => {
  it("extracts notes from Shopify tags", () => {
    const notes = extractNotes("", ["chocolate", "cherry", "caramel"]);
    expect(notes).toContain("Chocolate");
    expect(notes).toContain("Cherry");
    expect(notes).toContain("Caramel");
  });

  it("extracts notes from structured patterns", () => {
    const notes = extractNotes("Tasting notes: chocolate, cherry, and caramel", []);
    expect(notes).toContain("Chocolate");
    expect(notes).toContain("Cherry");
    expect(notes).toContain("Caramel");
  });

  it("extracts notes from explicit flavour pattern", () => {
    const notes = extractNotes("Flavours: chocolate and blueberry", []);
    expect(notes).toContain("Chocolate");
    expect(notes).toContain("Blueberry");
  });

  it("does not hallucinate notes from unrelated body copy", () => {
    // No "notes:", "flavours:", "taste:" etc. — the words chocolate/honey/clean
    // appear in marketing copy but should NOT be extracted as tasting notes.
    const notes = extractNotes(
      "Our clean water process and honey-colored chocolate packaging make this a special coffee.",
      []
    );
    expect(notes).toEqual([]);
  });

  it("extracts subword flavors inside an explicit segment", () => {
    const notes = extractNotes("Tasting notes: dark chocolate, brown sugar", []);
    expect(notes).toContain("Chocolate");
  });

  it("caps results at 6 notes", () => {
    const notes = extractNotes(
      "chocolate cherry caramel blueberry strawberry raspberry blackberry lemon",
      []
    );
    expect(notes.length).toBeLessThanOrEqual(6);
  });

  it("prunes texture words when enough flavor notes exist", () => {
    const notes = extractNotes(
      "Notes: chocolate, cherry, caramel, bright, clean, complex",
      []
    );
    // Should prefer flavor notes over texture words
    expect(notes).toContain("Chocolate");
    expect(notes).toContain("Cherry");
    expect(notes).toContain("Caramel");
  });

  it("returns empty array for empty input", () => {
    expect(extractNotes("", [])).toEqual([]);
  });

  it("handles repeated calls correctly (regex lastIndex reset)", () => {
    const notes1 = extractNotes("Notes: chocolate, cherry", []);
    const notes2 = extractNotes("Notes: caramel, vanilla", []);
    expect(notes1).toContain("Chocolate");
    expect(notes2).toContain("Caramel");
  });
});

describe("extractPrice", () => {
  it("extracts currency-qualified price", () => {
    expect(extractPrice("$22.00")).toBe("$22.00");
    expect(extractPrice("Price: $18.50")).toBe("$18.50");
  });

  it("extracts prices with various currency symbols", () => {
    expect(extractPrice("£15.00")).toBe("$15.00");
    expect(extractPrice("€20.00")).toBe("$20.00");
  });

  it("extracts prices with US$/C$/A$ prefixes", () => {
    expect(extractPrice("US$25.00")).toBe("$25.00");
    expect(extractPrice("C$30.00")).toBe("$30.00");
    expect(extractPrice("A$28.00")).toBe("$28.00");
  });

  it("falls back to plain decimal", () => {
    expect(extractPrice("Price 22.50 per bag")).toBe("$22.50");
  });

  it("rejects out-of-range prices", () => {
    expect(extractPrice("$0.00")).toBe("");
    expect(extractPrice("$3000.00")).toBe("");
  });

  it("rejects low decimal fallback prices", () => {
    expect(extractPrice("Only 3.50")).toBe("");
  });

  it("handles comma-formatted numbers", () => {
    expect(extractPrice("$1,200.00")).toBe("$1200.00");
  });

  it("returns empty string when no price found", () => {
    expect(extractPrice("No price here")).toBe("");
    expect(extractPrice("")).toBe("");
  });
});

describe("isMerchandise", () => {
  it("detects merch by product type", () => {
    expect(isMerchandise("Cool Item", "apparel", [])).toBe(true);
    expect(isMerchandise("Cool Item", "merchandise", [])).toBe(true);
  });

  it("detects merch by title keyword", () => {
    expect(isMerchandise("Coffee Mug", "", [])).toBe(true);
    expect(isMerchandise("Branded Hoodie", "", [])).toBe(true);
    expect(isMerchandise("Gift Card", "", [])).toBe(true);
  });

  it("detects merch by tag", () => {
    expect(isMerchandise("Item", "equipment", ["brewing"])).toBe(true);
  });

  it("does not flag coffee as merch", () => {
    expect(isMerchandise("Ethiopia Yirgacheffe", "coffee", ["single-origin"])).toBe(false);
    expect(isMerchandise("Morning Blend", "", [])).toBe(false);
  });
});
