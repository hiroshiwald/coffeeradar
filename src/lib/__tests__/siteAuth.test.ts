import { describe, it, expect } from "vitest";
import { __testing } from "../siteAuth";

const { isAuthData } = __testing;

describe("isAuthData", () => {
  it("accepts a valid object", () => {
    expect(isAuthData({ users: [], protectionEnabled: false })).toBe(true);
  });

  it("accepts users-only objects", () => {
    expect(isAuthData({ users: [{ username: "x" }] })).toBe(true);
  });

  it("rejects null and primitives", () => {
    expect(isAuthData(null)).toBe(false);
    expect(isAuthData("hi")).toBe(false);
    expect(isAuthData(42)).toBe(false);
  });

  it("rejects objects without a users array", () => {
    expect(isAuthData({})).toBe(false);
    expect(isAuthData({ users: "nope" })).toBe(false);
  });
});
