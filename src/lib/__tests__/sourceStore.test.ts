import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module so we can spy on initDb without touching libSQL.
vi.mock("../db", () => {
  return {
    hasTurso: vi.fn(() => true),
    initDb: vi.fn(async () => {}),
    getFeedSources: vi.fn(async () => []),
    getFeedResults: vi.fn(async () => ({ "http://a.com/feed": "ok" })),
    upsertFeedSource: vi.fn(async () => {}),
    removeFeedSource: vi.fn(async () => {}),
    toggleFeedSource: vi.fn(async () => {}),
  };
});

vi.mock("../../../data/sources.json", () => ({
  default: [
    { name: "Test Roaster", url: "http://test.com/feed", website: "http://test.com" },
  ],
}));

import * as db from "../db";
import {
  __resetSourceStoreForTests,
  addOrUpdateMasterSource,
  getSourceHealth,
  listEnabledMasterSources,
  listMasterSources,
  removeMasterSource,
  setSourceHealth,
  toggleMasterSource,
} from "../sourceStore";

beforeEach(() => {
  __resetSourceStoreForTests();
  vi.mocked(db.hasTurso).mockReturnValue(true);
  vi.mocked(db.initDb).mockClear();
  vi.mocked(db.getFeedResults).mockClear();
});

describe("sourceStore init memoization", () => {
  it("calls initDb exactly once across many parallel reads", async () => {
    await Promise.all([
      listMasterSources(),
      listMasterSources(),
      listEnabledMasterSources(),
      listMasterSources(),
    ]);
    expect(db.initDb).toHaveBeenCalledTimes(1);
  });

  it("re-initializes after an explicit reset", async () => {
    await listMasterSources();
    __resetSourceStoreForTests();
    await listMasterSources();
    expect(db.initDb).toHaveBeenCalledTimes(2);
  });
});

describe("sourceStore in-memory path (no Turso)", () => {
  beforeEach(() => {
    vi.mocked(db.hasTurso).mockReturnValue(false);
  });

  it("returns sources loaded from disk", async () => {
    const sources = await listMasterSources();
    expect(sources).toEqual([
      { name: "Test Roaster", url: "http://test.com/feed", website: "http://test.com", enabled: true },
    ]);
  });

  it("filters enabled sources", async () => {
    await addOrUpdateMasterSource({
      name: "Disabled", url: "http://disabled.com/feed", website: "http://disabled.com", enabled: false,
    });
    const enabled = await listEnabledMasterSources();
    expect(enabled.every((s) => s.enabled !== false)).toBe(true);
  });

  it("adds, toggles, and removes sources", async () => {
    const afterAdd = await addOrUpdateMasterSource({
      name: "New", url: "http://new.com/feed", website: "http://new.com", enabled: true,
    });
    expect(afterAdd.find((s) => s.url === "http://new.com/feed")).toBeTruthy();

    const afterToggle = await toggleMasterSource("http://new.com/feed");
    expect(afterToggle.find((s) => s.url === "http://new.com/feed")!.enabled).toBe(false);

    const afterRemove = await removeMasterSource("http://new.com/feed");
    expect(afterRemove.find((s) => s.url === "http://new.com/feed")).toBeUndefined();
  });

  it("returns empty health by default", async () => {
    const health = await getSourceHealth();
    expect(health).toEqual({});
  });

  it("persists health via setSourceHealth / getSourceHealth", async () => {
    await setSourceHealth({ "http://test.com/feed": "ok" });
    const health = await getSourceHealth();
    expect(health).toEqual({ "http://test.com/feed": "ok" });
  });
});

describe("sourceStore health with Turso", () => {
  it("delegates getSourceHealth to getFeedResults", async () => {
    const health = await getSourceHealth();
    expect(db.getFeedResults).toHaveBeenCalledTimes(1);
    expect(health).toEqual({ "http://a.com/feed": "ok" });
  });

  it("setSourceHealth is a no-op with Turso", async () => {
    await setSourceHealth({ "http://x.com/feed": "error" });
    const health = await getSourceHealth();
    expect(health).toEqual({ "http://a.com/feed": "ok" });
  });
});
