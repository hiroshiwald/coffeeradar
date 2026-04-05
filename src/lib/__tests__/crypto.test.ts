import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../crypto";

describe("hashPassword", () => {
  it("returns a hash and salt", async () => {
    const result = await hashPassword("test-password");
    expect(result.hash).toBeTruthy();
    expect(result.salt).toBeTruthy();
    expect(result.hash.length).toBe(64); // SHA-256 hex = 64 chars
    expect(result.salt.length).toBe(32); // 16 bytes hex = 32 chars
  });

  it("is deterministic with same salt", async () => {
    const first = await hashPassword("my-password");
    const second = await hashPassword("my-password", first.salt);
    expect(second.hash).toBe(first.hash);
    expect(second.salt).toBe(first.salt);
  });

  it("produces different hashes with different salts", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    // Different random salts should yield different hashes
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const { hash, salt } = await hashPassword("correct-password");
    const result = await verifyPassword("correct-password", salt, hash);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const { hash, salt } = await hashPassword("correct-password");
    const result = await verifyPassword("wrong-password", salt, hash);
    expect(result).toBe(false);
  });

  it("returns false for tampered hash", async () => {
    const { salt } = await hashPassword("my-password");
    const fakeHash = "a".repeat(64);
    const result = await verifyPassword("my-password", salt, fakeHash);
    expect(result).toBe(false);
  });

  it("returns false for mismatched hash length", async () => {
    const { salt } = await hashPassword("my-password");
    const result = await verifyPassword("my-password", salt, "short");
    expect(result).toBe(false);
  });
});
