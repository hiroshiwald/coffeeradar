"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiResponse } from "@/lib/types";
import { logger } from "@/lib/logger";

export function useCoffeeData() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
      logger.warn("[useCoffeeData] fetch failed, keeping existing data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, refresh };
}
