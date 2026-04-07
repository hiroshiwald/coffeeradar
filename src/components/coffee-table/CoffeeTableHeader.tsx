"use client";

import { SortDir, SortKey } from "@/lib/coffeeFilters";

interface Props {
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
}

const COLUMNS: [SortKey, string][] = [
  ["date", "Date"],
  ["roaster", "Roaster"],
  ["coffee", "Coffee"],
  ["type", "Type"],
  ["process", "Process"],
];

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function CoffeeTableHeader({ sortKey, sortDir, onToggleSort }: Props) {
  return (
    <thead>
      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 w-12"></th>
        {COLUMNS.map(([key, label]) => (
          <th
            key={key}
            onClick={() => onToggleSort(key)}
            className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap"
          >
            {label}
            <SortIcon active={sortKey === key} dir={sortDir} />
          </th>
        ))}
        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Notes</th>
        <th
          onClick={() => onToggleSort("price")}
          className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap"
        >
          Price
          <SortIcon active={sortKey === "price"} dir={sortDir} />
        </th>
      </tr>
    </thead>
  );
}
