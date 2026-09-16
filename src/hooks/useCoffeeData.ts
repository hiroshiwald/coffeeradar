"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiResponse } from "@/lib/types";
import { readApiResponse } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

const BG_REFRESH_DELAY_MS = 12_000;

export function useCoffeeData() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const bgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The server refreshes feeds after answering a manual refresh, so read once
  // more after a delay. A failed follow-up keeps the payload already shown.
  const scheduleFollowUp = useCallback(() => {
    setIsBackgroundRefreshing(true);
    bgTimerRef.current = setTimeout(async () => {
      try {
        setData(await readApiResponse(await fetch("/api/coffees")));
      } catch (err) {
        logger.warn("[useCoffeeData] follow-up fetch failed, keeping existing data", err);
      }
      setIsBackgroundRefreshing(false);
    }, BG_REFRESH_DELAY_MS);
  }, []);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(refresh ? "/api/coffees?refresh=true" : "/api/coffees");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      // readApiResponse rejects error statuses and malformed bodies, so a
      // failed request never replaces the last good payload.
      const json = await readApiResponse(res);
      setData(json);
      if (json.meta.backgroundRefresh) scheduleFollowUp();
    } catch (err) {
      logger.warn("[useCoffeeData] fetch failed, keeping existing data", err);
    } finally {
      setLoading(false);
    }
  }, [scheduleFollowUp]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    return () => { if (bgTimerRef.current) clearTimeout(bgTimerRef.current); };
  }, []);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, refresh, isBackgroundRefreshing };
}
