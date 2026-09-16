import { describe, it, expect } from "vitest";
import { readApiResponse } from "../apiResponse";

const VALID = {
  coffees: [],
  meta: { healthy: 1, failed: 0, total: 1, lastRefresh: "2026-09-16T00:00:00Z", isFallback: false },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("readApiResponse", () => {
  it("returns a well-formed 200 body", async () => {
    await expect(readApiResponse(json(VALID))).resolves.toEqual(VALID);
  });

  it("rejects a 4xx/5xx even when the body parses", async () => {
    await expect(readApiResponse(json({}, 500))).rejects.toThrow("responded 500");
    await expect(readApiResponse(json(VALID, 401))).rejects.toThrow("responded 401");
  });

  // The failure class the 200 check exists for: an empty object is truthy, so
  // storing it would make `data.coffees.filter` throw at render time.
  it("rejects a 200 whose body is not the API contract", async () => {
    await expect(readApiResponse(json({}))).rejects.toThrow("malformed");
    await expect(readApiResponse(json(null))).rejects.toThrow("malformed");
    await expect(readApiResponse(json({ coffees: "nope", meta: {} }))).rejects.toThrow("malformed");
    await expect(readApiResponse(json({ coffees: [] }))).rejects.toThrow("malformed");
  });

  it("rejects a 200 that is not JSON", async () => {
    const res = new Response("<html>", { status: 200 });
    await expect(readApiResponse(res)).rejects.toThrow();
  });
});
