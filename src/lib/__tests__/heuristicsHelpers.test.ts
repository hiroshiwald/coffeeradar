import { describe, it, expect } from "vitest";
import {
  filterNoiseTokens,
  normalizeNoteCase,
  tokenizeNotesSegment,
} from "../heuristics";

describe("tokenizeNotesSegment", () => {
  it("splits on commas", () => {
    expect(tokenizeNotesSegment("blueberry, dark chocolate, honey")).toEqual([
      "blueberry",
      "dark chocolate",
      "honey",
    ]);
  });

  it("splits on the word and", () => {
    expect(tokenizeNotesSegment("plum and peach and cocoa")).toEqual([
      "plum",
      "peach",
      "cocoa",
    ]);
  });

  it("splits on slashes and semicolons", () => {
    expect(tokenizeNotesSegment("citrus/floral; nutty")).toEqual([
      "citrus",
      "floral",
      "nutty",
    ]);
  });

  it("collapses whitespace", () => {
    expect(tokenizeNotesSegment("  brown   sugar ")).toEqual(["brown sugar"]);
  });
});

describe("filterNoiseTokens", () => {
  it("drops too-short and too-long tokens", () => {
    const tokens = ["a", "ok", "x".repeat(31), "fine"];
    expect(filterNoiseTokens(tokens)).toEqual(["ok", "fine"]);
  });
});

describe("normalizeNoteCase", () => {
  it("title-cases each word", () => {
    expect(normalizeNoteCase("brown sugar")).toBe("Brown Sugar");
    expect(normalizeNoteCase("dark chocolate")).toBe("Dark Chocolate");
  });
});
