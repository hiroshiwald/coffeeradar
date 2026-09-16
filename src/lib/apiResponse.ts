import { ApiResponse } from "./types";

/**
 * Reads a `/api/coffees` response at the network boundary.
 *
 * Throws on a 4xx/5xx status and on a 2xx body that is not the API contract.
 * Callers read `data.coffees` and `data.meta` directly, so a stored error body
 * or an empty object would throw later at the point of use instead of here.
 */
export async function readApiResponse(res: Response): Promise<ApiResponse> {
  if (!res.ok) throw new Error(`/api/coffees responded ${res.status}`);
  const body: unknown = await res.json();
  if (!isApiResponse(body)) throw new Error("/api/coffees returned a malformed body");
  return body;
}

function isApiResponse(v: unknown): v is ApiResponse {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.coffees) && typeof o.meta === "object" && o.meta !== null;
}
