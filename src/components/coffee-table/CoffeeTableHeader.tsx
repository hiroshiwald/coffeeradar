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

/**
 * A button inside the th, so the sort is reachable by keyboard. The button
 * carries the padding, so the whole cell is the tap target.
 */
function SortableTh({ column, label, sortKey, sortDir, onToggleSort }: Props & { column: SortKey; label: string }) {
  return (
    <th className="p-0 text-xs lg:text-sm text-left font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap">
      <button type="button" onClick={() => onToggleSort(column)} className="w-full text-left px-1.5 py-2 lg:px-4 lg:py-3 select-none">
        {label}
        <SortIcon active={sortKey === column} dir={sortDir} />
      </button>
    </th>
  );
}

export default function CoffeeTableHeader(props: Props) {
  // Below lg the header is a wrapping row of sort buttons above the cards. The
  // unsortable headers are sr-only there, so screen readers keep 8 columns.
  return (
    <thead className="block lg:table-header-group">
      <tr className="flex flex-wrap px-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 lg:table-row">
        <th className="max-lg:sr-only px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 w-12"></th>
        {COLUMNS.map(([key, label]) => (
          <SortableTh key={key} column={key} label={label} {...props} />
        ))}
        <th className="max-lg:sr-only px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Notes</th>
        <SortableTh column="price" label="Price" {...props} />
      </tr>
    </thead>
  );
}
