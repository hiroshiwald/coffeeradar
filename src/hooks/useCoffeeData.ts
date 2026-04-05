"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiResponse } from "@/lib/types";

export function useCoffeeData() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const url = refresh ? "/api/coffees?refresh=true" : "/api/coffees";
      const res = await fetch(url);
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, refresh };
}
