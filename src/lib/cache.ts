import { ApiResponse } from "./types";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let cached: { data: ApiResponse; timestamp: number } | null = null;

export function getCached(): ApiResponse | null {
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) return null;
  return cached.data;
}

export function setCache(data: ApiResponse): void {
  cached = { data, timestamp: Date.now() };
}
