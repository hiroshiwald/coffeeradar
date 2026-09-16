import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readTipLinkSettings,
  writeTipLinkSettings,
  __resetTipLinkStoreForTests,
} from "../tipLinkStore";

// These cover the no-Turso path only: the Turso path needs a live database,
// which db.test.ts also leaves alone.
describe("tipLinkStore without Turso", () => {
  const originalTurso = process.env.TURSO_DATABASE_URL;
  const originalTip = process.env.NEXT_PUBLIC_TIP_URL;

  beforeEach(() => {
    delete process.env.TURSO_DATABASE_URL;
    __resetTipLinkStoreForTests();
  });

  afterEach(() => {
    if (originalTurso === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = originalTurso;
    if (originalTip === undefined) delete process.env.NEXT_PUBLIC_TIP_URL;
    else process.env.NEXT_PUBLIC_TIP_URL = originalTip;
  });

  it("falls back to the env url with the link on", async () => {
    process.env.NEXT_PUBLIC_TIP_URL = "https://ko-fi.com/fromenv";
    expect(await readTipLinkSettings()).toEqual({ enabled: true, url: "https://ko-fi.com/fromenv" });
  });

  it("reports an empty url when the env var is unset", async () => {
    delete process.env.NEXT_PUBLIC_TIP_URL;
    expect(await readTipLinkSettings()).toEqual({ enabled: true, url: "" });
  });

  it("reads back what was written instead of the env fallback", async () => {
    process.env.NEXT_PUBLIC_TIP_URL = "https://ko-fi.com/fromenv";
    await writeTipLinkSettings({ enabled: false, url: "https://ko-fi.com/stored" });
    expect(await readTipLinkSettings()).toEqual({ enabled: false, url: "https://ko-fi.com/stored" });
  });
});
