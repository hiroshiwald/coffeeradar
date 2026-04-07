import { describe, it, expect, vi } from "vitest";
import { chunkedBatchInsert } from "../db";
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
