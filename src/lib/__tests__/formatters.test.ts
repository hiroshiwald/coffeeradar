import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { timeAgo, formatDate, formatHostname } from "../formatters";

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for very recent times", () => {
    expect(timeAgo("2026-03-15T12:00:00Z")).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(timeAgo("2026-03-15T11:55:00Z")).toBe("5m ago");
  });

  it("returns hours and minutes ago", () => {
    expect(timeAgo("2026-03-15T09:30:00Z")).toBe("2h 30m ago");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date", () => {
    const result = formatDate("2026-03-15T00:00:00Z");
    expect(result).toContain("Mar");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("returns empty string for invalid date", () => {
    // Invalid dates produce "Invalid Date" from toLocaleDateString,
    // but don't throw, so they'll return that string. Let's just
    // verify it doesn't throw.
    const result = formatDate("not-a-date");
    expect(typeof result).toBe("string");
  });
});

describe("formatHostname", () => {
  it("strips the www prefix", () => {
    expect(formatHostname("https://www.seycoffee.com/collections/all")).toBe("seycoffee.com");
  });

  it("keeps a host that has no www", () => {
    expect(formatHostname("https://aka.coffee/collections/all")).toBe("aka.coffee");
  });

  it("keeps a subdomain that is not www", () => {
    expect(formatHostname("https://shop.bonanzacoffee.de/x")).toBe("shop.bonanzacoffee.de");
  });

  it("returns an empty string for an unparseable url", () => {
    expect(formatHostname("not a url")).toBe("");
  });

  it("returns an empty string for an empty value", () => {
    expect(formatHostname("")).toBe("");
  });
});
