"use client";

import { memo } from "react";
import { CoffeeEntry } from "@/lib/types";
import { formatDate } from "@/lib/formatters";
import { getNoteColor } from "@/lib/noteColors";

interface Props {
  coffee: CoffeeEntry;
  onSelectNote: (note: string) => void;
}

function CoffeeTableRow({ coffee: c, onSelectNote }: Props) {
  return (
    <tr
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 56px' }}
      className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
    >
      <td className="px-4 py-2">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.imageUrl}
            alt=""
            className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(c.date)}</td>
      <td className="px-4 py-3 font-medium whitespace-nowrap">{c.roaster}</td>
      <td className="px-4 py-3">
        <a href={c.link} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
          {c.coffee}
        </a>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {c.isMerch ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
            Merch
          </span>
        ) : c.type !== "Unknown" ? (
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs ${
              c.type === "Single Origin"
                ? "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300"
                : "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
            }`}
          >
            {c.type}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{c.process}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {c.tastingNotes.map((note) => (
            <button
              key={note}
              onClick={() => onSelectNote(note)}
              className={`px-2 py-0.5 rounded-full text-xs transition-colors hover:opacity-80 ${getNoteColor(note)}`}
            >
              {note}
            </button>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap font-mono text-xs tabular-nums">
        {c.price}
      </td>
    </tr>
  );
}

export default memo(CoffeeTableRow);
