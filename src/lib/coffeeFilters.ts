import { CoffeeEntry } from "./types";

export type SortKey = "date" | "roaster" | "coffee" | "type" | "process" | "price";
export type SortDir = "asc" | "desc";

export interface CoffeeFilters {
  search: string;
  filterType: string;
  filterProcess: string;
  filterNote: string;
  showMerch: boolean;
}

export function filterCoffees(coffees: CoffeeEntry[], filters: CoffeeFilters): CoffeeEntry[] {
  let list = coffees;

  if (!filters.showMerch) list = list.filter((c) => !c.isMerch);

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (c) =>
        c.roaster.toLowerCase().includes(q) ||
        c.coffee.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.process.toLowerCase().includes(q) ||
        c.tastingNotes.some((n) => n.toLowerCase().includes(q))
    );
  }

  if (filters.filterType) list = list.filter((c) => c.type === filters.filterType);
  if (filters.filterProcess) list = list.filter((c) => c.process === filters.filterProcess);
  if (filters.filterNote) list = list.filter((c) => c.tastingNotes.includes(filters.filterNote));

  return list;
}

export function sortCoffees(coffees: CoffeeEntry[], sortKey: SortKey, sortDir: SortDir): CoffeeEntry[] {
  return [...coffees].sort((a, b) => {
    let va: string | number = "";
    let vb: string | number = "";
    switch (sortKey) {
      case "date":
        va = new Date(a.date).getTime() || 0;
        vb = new Date(b.date).getTime() || 0;
        break;
      case "price":
        va = parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0;
        vb = parseFloat(b.price.replace(/[^0-9.]/g, "")) || 0;
        break;
      default:
        va = a[sortKey].toLowerCase();
        vb = b[sortKey].toLowerCase();
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

export function countNotes(coffees: CoffeeEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of coffees) {
    if (c.isMerch) continue;
    for (const n of c.tastingNotes) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
  return counts;
}
