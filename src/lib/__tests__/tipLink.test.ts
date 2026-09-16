import { describe, it, expect } from "vitest";
import { resolveTipUrl, validateTipLinkInput, TIP_URL_MAX_LENGTH } from "../tipLink";

const VALID = "https://ko-fi.com/coffeeradar";

describe("resolveTipUrl", () => {
  it("returns the url when the toggle is on and getTipUrl accepts it", () => {
    expect(resolveTipUrl({ enabled: true, url: VALID })).toBe(VALID);
  });

  it("returns null when the toggle is off, even for a valid url", () => {
    expect(resolveTipUrl({ enabled: false, url: VALID })).toBeNull();
  });

  it("returns null when the toggle is on but the url is not https", () => {
    expect(resolveTipUrl({ enabled: true, url: "http://ko-fi.com/coffeeradar" })).toBeNull();
  });

  it("returns null when the toggle is on but no url is stored", () => {
    expect(resolveTipUrl({ enabled: true, url: "" })).toBeNull();
  });
});

describe("validateTipLinkInput", () => {
  it("accepts a valid on state and trims the url", () => {
    const result = validateTipLinkInput({ enabled: true, url: `  ${VALID}  ` });
    expect(result).toEqual({ ok: true, settings: { enabled: true, url: VALID } });
  });

  it("accepts an off state with an unusable url", () => {
    const result = validateTipLinkInput({ enabled: false, url: "not a url" });
    expect(result).toEqual({ ok: true, settings: { enabled: false, url: "not a url" } });
  });

  it("rejects turning the link on without an https url", () => {
    const result = validateTipLinkInput({ enabled: true, url: "http://ko-fi.com/x" });
    expect(result.ok).toBe(false);
  });

  it("rejects a body that is not an object", () => {
    expect(validateTipLinkInput("enabled").ok).toBe(false);
    expect(validateTipLinkInput(null).ok).toBe(false);
  });

  it("rejects a non-boolean enabled", () => {
    expect(validateTipLinkInput({ enabled: "true", url: VALID }).ok).toBe(false);
  });

  it("rejects a non-string url", () => {
    expect(validateTipLinkInput({ enabled: false, url: 42 }).ok).toBe(false);
  });

  it("rejects a url past the length bound", () => {
    const long = `https://ko-fi.com/${"a".repeat(TIP_URL_MAX_LENGTH)}`;
    expect(validateTipLinkInput({ enabled: true, url: long }).ok).toBe(false);
  });
});
