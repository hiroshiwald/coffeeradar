"use client";

import { useMemo, useState } from "react";
import { CoffeeEntry } from "@/lib/types";
import {
  CoffeeFilters,
  SortDir,
  SortKey,
  countNotes,
  filterCoffees,
  sortCoffees,
} from "@/lib/coffeeFilters";

export interface UseCoffeeFiltersResult {
  filters: CoffeeFilters;
  sortKey: SortKey;
  sortDir: SortDir;
  filtered: CoffeeEntry[];
  popularNotes: string[];
  setSearch: (v: string) => void;
  setFilterType: (v: string) => void;
  setFilterProcess: (v: string) => void;
  setFilterNote: (v: string) => void;
  setShowMerch: (v: boolean) => void;
  toggleSort: (key: SortKey) => void;
}

// Owns all client-side filter/sort state for the coffee table. Extracted from
// CoffeeTable so the table component is just markup and the logic is testable
// in isolation.
export function useCoffeeFilters(coffees: CoffeeEntry[] | undefined): UseCoffeeFiltersResult {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [filterNote, setFilterNote] = useState("");
  const [showMerch, setShowMerch] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filters: CoffeeFilters = { search, filterType, filterProcess, filterNote, showMerch };

  const filtered = useMemo(() => {
    if (!coffees) return [];
    return sortCoffees(filterCoffees(coffees, filters), sortKey, sortDir);
  }, [coffees, search, filterType, filterProcess, filterNote, showMerch, sortKey, sortDir]);

  const popularNotes = useMemo(() => {
    if (!coffees) return [];
    return Array.from(countNotes(coffees).entries())
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
  }, [coffees]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  return {
    filters,
    sortKey,
    sortDir,
    filtered,
    popularNotes,
    setSearch,
    setFilterType,
    setFilterProcess,
    setFilterNote,
    setShowMerch,
    toggleSort,
  };
}
