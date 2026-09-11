import { describe, it, expect } from "vitest";
import { getTipUrl } from "../tipUrl";

describe("getTipUrl", () => {
  it("returns an https url unchanged", () => {
    expect(getTipUrl("https://ko-fi.com/coffeeradar")).toBe("https://ko-fi.com/coffeeradar");
  });

  it("rejects http", () => {
    expect(getTipUrl("http://ko-fi.com/coffeeradar")).toBeNull();
  });

  it("rejects a non-http protocol", () => {
    expect(getTipUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects an unparseable value", () => {
    expect(getTipUrl("not a url")).toBeNull();
  });

  it("rejects undefined", () => {
    expect(getTipUrl(undefined)).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(getTipUrl("")).toBeNull();
  });
});
