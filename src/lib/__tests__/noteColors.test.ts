import { describe, it, expect } from "vitest";
import { getNoteColor } from "../noteColors";

describe("getNoteColor", () => {
  it("returns berry family color for berry notes", () => {
    const color = getNoteColor("Blueberry");
    expect(color).toContain("bg-rose");
  });

  it("returns citrus family color for citrus notes", () => {
    const color = getNoteColor("Lemon");
    expect(color).toContain("bg-amber");
  });

  it("returns chocolate family color", () => {
    const color = getNoteColor("Chocolate");
    expect(color).toContain("bg-yellow");
  });

  it("returns floral family color", () => {
    const color = getNoteColor("Jasmine");
    expect(color).toContain("bg-violet");
  });

  it("is case insensitive", () => {
    expect(getNoteColor("CHOCOLATE")).toBe(getNoteColor("chocolate"));
    expect(getNoteColor("Blueberry")).toBe(getNoteColor("blueberry"));
  });

  it("returns default color for unknown notes", () => {
    const color = getNoteColor("unknown-flavor-xyz");
    expect(color).toContain("bg-gray");
  });
});
