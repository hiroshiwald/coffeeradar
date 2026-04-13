"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiResponse } from "@/lib/types";
import { logger } from "@/lib/logger";

const BG_REFRESH_DELAY_MS = 12_000;

export function useCoffeeData() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const bgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const url = refresh ? "/api/coffees?refresh=true" : "/api/coffees";
      const res = await fetch(url);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const json: ApiResponse = await res.json();
      setData(json);

      if (json.meta.backgroundRefresh) {
        setIsBackgroundRefreshing(true);
        bgTimerRef.current = setTimeout(async () => {
          try {
            const followUp = await fetch("/api/coffees");
            if (followUp.ok) {
              const updated: ApiResponse = await followUp.json();
              setData(updated);
            }
          } catch {
            // Keep existing data
          }
          setIsBackgroundRefreshing(false);
        }, BG_REFRESH_DELAY_MS);
      }
    } catch (err) {
      logger.warn("[useCoffeeData] fetch failed, keeping existing data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    return () => {
      if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
    };
  }, []);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, refresh, isBackgroundRefreshing };
}
