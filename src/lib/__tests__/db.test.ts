import { describe, it, expect, vi } from "vitest";
import { chunkedBatchInsert, DEDUPE_COFFEES_SQL } from "../db";
import { createClient } from "@libsql/client";
import type { Client } from "@libsql/client/web";

function makeFakeClient() {
  const calls: Array<Array<{ sql: string; args: unknown[] }>> = [];
  const client = {
    batch: vi.fn(async (stmts: Array<{ sql: string; args: unknown[] }>) => {
      calls.push(stmts);
    }),
  } as unknown as Client;
  return { client, calls, batchSpy: client.batch as unknown as ReturnType<typeof vi.fn> };
}

describe("chunkedBatchInsert", () => {
  const sql = "INSERT INTO t (a) VALUES (?)";

  it("is a no-op for empty input", async () => {
    const { client, batchSpy } = makeFakeClient();
    await chunkedBatchInsert(client, sql, [], (n) => [n]);
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it("runs a single batch when rows fit", async () => {
    const { client, calls } = makeFakeClient();
    await chunkedBatchInsert(client, sql, [1, 2, 3], (n) => [n], 50);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(3);
    expect(calls[0][0]).toEqual({ sql, args: [1] });
  });

  it("splits into multiple batches at chunk boundary", async () => {
    const { client, calls } = makeFakeClient();
    const rows = Array.from({ length: 51 }, (_, i) => i);
    await chunkedBatchInsert(client, sql, rows, (n) => [n], 25);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toHaveLength(25);
    expect(calls[1]).toHaveLength(25);
    expect(calls[2]).toHaveLength(1);
  });

  it("splits exact multiples cleanly", async () => {
    const { client, calls } = makeFakeClient();
    const rows = Array.from({ length: 100 }, (_, i) => i);
    await chunkedBatchInsert(client, sql, rows, (n) => [n], 50);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toHaveLength(50);
    expect(calls[1]).toHaveLength(50);
  });

  it("propagates errors from batch", async () => {
    const failing = {
      batch: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as Client;
    await expect(
      chunkedBatchInsert(failing, sql, [1, 2], (n) => [n]),
    ).rejects.toThrow("boom");
  });
});

// Runs the production dedupe statement against a real in-memory SQLite so the
// grouping semantics are tested, not just the SQL text. The table mirrors the
// columns DEDUPE_COFFEES_SQL reads.
describe("DEDUPE_COFFEES_SQL", () => {
  async function makeDb() {
    const db = createClient({ url: "file::memory:" });
    await db.execute(
      `CREATE TABLE coffees (
        id TEXT PRIMARY KEY,
        roaster TEXT NOT NULL,
        coffee TEXT NOT NULL,
        link TEXT DEFAULT '',
        date TEXT NOT NULL
      )`,
    );
    return db;
  }

  async function insert(
    db: Awaited<ReturnType<typeof makeDb>>,
    rows: Array<[string, string, string, string, string]>,
  ) {
    for (const args of rows) {
      await db.execute({ sql: `INSERT INTO coffees VALUES (?, ?, ?, ?, ?)`, args });
    }
  }

  async function roasters(db: Awaited<ReturnType<typeof makeDb>>) {
    const res = await db.execute(`SELECT roaster FROM coffees ORDER BY rowid`);
    return res.rows.map((r) => String(r.roaster));
  }

  it("keeps the renamed row and drops the pre-rename duplicate", async () => {
    const db = await makeDb();
    await insert(db, [
      ["old-id", "Shop Coffee - Resident Coffee Roasters", "Kenya Kiriga AA", "https://resident.coffee/p/1", "2026-09-01"],
      ["new-id", "Resident Coffee Roasters", "Kenya Kiriga AA", "https://resident.coffee/p/1", "2026-09-01"],
    ]);

    const result = await db.execute(DEDUPE_COFFEES_SQL);

    expect(result.rowsAffected).toBe(1);
    expect(await roasters(db)).toEqual(["Resident Coffee Roasters"]);
  });

  it("keeps coffees that share a name across roasters", async () => {
    const db = await makeDb();
    await insert(db, [
      ["a", "Sey Coffee", "Ethiopia Yirgacheffe", "https://seycoffee.com/p/1", "2026-09-01"],
      ["b", "Luna Coffee", "Ethiopia Yirgacheffe", "https://lunacoffee.ca/p/1", "2026-09-01"],
    ]);

    const result = await db.execute(DEDUPE_COFFEES_SQL);

    expect(result.rowsAffected).toBe(0);
    expect(await roasters(db)).toEqual(["Sey Coffee", "Luna Coffee"]);
  });

  it("keeps separate releases of the same coffee on different dates", async () => {
    const db = await makeDb();
    await insert(db, [
      ["a", "Luna Coffee", "Colombia Wilder Lasso", "https://lunacoffee.ca/p/1", "2026-08-01"],
      ["b", "Luna Coffee", "Colombia Wilder Lasso", "https://lunacoffee.ca/p/1", "2026-09-01"],
    ]);

    const result = await db.execute(DEDUPE_COFFEES_SQL);

    expect(result.rowsAffected).toBe(0);
  });

  it("is a no-op on an already clean table", async () => {
    const db = await makeDb();
    await insert(db, [
      ["a", "Luna Coffee", "Kenya Kiriga AA", "https://lunacoffee.ca/p/1", "2026-09-01"],
    ]);

    const result = await db.execute(DEDUPE_COFFEES_SQL);

    expect(result.rowsAffected).toBe(0);
  });
});
