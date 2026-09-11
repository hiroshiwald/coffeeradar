"use client";

import { CoffeeEntry } from "@/lib/types";
import { RoasterSummary } from "@/lib/roasterSummary";
import { formatDate, formatHostname } from "@/lib/formatters";
import { getNoteColor } from "@/lib/noteColors";

function CoffeeRow({ coffee: c }: { coffee: CoffeeEntry }) {
  const meta = [c.process, formatDate(c.date)].filter(Boolean).join(" · ");

  return (
    <div className="grid grid-cols-[32px_1fr] sm:grid-cols-[32px_1fr_auto_auto] gap-x-3 gap-y-1.5 items-center px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-sm">
      {c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={c.imageUrl}
          alt=""
          className="w-8 h-8 rounded-md object-cover bg-gray-100 dark:bg-gray-800"
          loading="lazy"
        />
      ) : (
        <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-800" />
      )}

      <div className="min-w-0 flex flex-wrap gap-x-2.5 items-baseline">
        <a
          href={c.link}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline underline-offset-2"
        >
          {c.coffee}
        </a>
        {meta && <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{meta}</span>}
      </div>

      <div className="col-start-2 sm:col-start-3 flex flex-wrap gap-1">
        {c.tastingNotes.map((n) => (
          <span key={n} className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${getNoteColor(n)}`}>
            {n}
          </span>
        ))}
      </div>

      <span className="col-start-2 sm:col-start-4 font-mono text-xs text-gray-600 dark:text-gray-300">
        {c.price}
      </span>
    </div>
  );
}

export default function RoasterPanel({
  summary,
  id,
  onClose,
}: {
  summary: RoasterSummary;
  id: string;
  onClose: () => void;
}) {
  const hostname = formatHostname(summary.website);

  return (
    <div id={id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 text-[13px]">
        <span className="font-medium text-[15px] truncate">{summary.name}</span>
        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{summary.count} recent</span>
        {hostname && (
          <a
            href={summary.website}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white whitespace-nowrap truncate"
          >
            {hostname} ↗
          </a>
        )}
        <button
          type="button"
          aria-label={`Close ${summary.name}`}
          onClick={onClose}
          className={`${hostname ? "" : "ml-auto "}text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-1`}
        >
          ✕
        </button>
      </div>

      {summary.coffees.map((c) => (
        <CoffeeRow key={c.id} coffee={c} />
      ))}
    </div>
  );
}
