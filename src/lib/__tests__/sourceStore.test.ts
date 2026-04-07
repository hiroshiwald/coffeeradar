import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module so we can spy on initDb without touching libSQL.
vi.mock("../db", () => {
  return {
    hasTurso: vi.fn(() => true),
    initDb: vi.fn(async () => {}),
    getFeedSources: vi.fn(async () => []),
    upsertFeedSource: vi.fn(async () => {}),
    removeFeedSource: vi.fn(async () => {}),
    toggleFeedSource: vi.fn(async () => {}),
  };
});

import * as db from "../db";
import {
  __resetSourceStoreInitForTests,
  listEnabledMasterSources,
  listMasterSources,
} from "../sourceStore";

beforeEach(() => {
  __resetSourceStoreInitForTests();
  (db.initDb as ReturnType<typeof vi.fn>).mockClear();
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
    __resetSourceStoreInitForTests();
    await listMasterSources();
    expect(db.initDb).toHaveBeenCalledTimes(2);
  });
});
