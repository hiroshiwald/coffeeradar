"use client";

import { RoasterLetterGroup, RoasterSummary } from "@/lib/roasterSummary";
import RoasterPanel from "./RoasterPanel";

/** Fragment id for a letter block. "#" is not usable in a URL fragment. */
export function letterAnchorId(letter: string): string {
  return letter === "#" ? "letter-num" : `letter-${letter}`;
}

function RoasterName({
  roaster,
  onToggle,
}: {
  roaster: RoasterSummary;
  onToggle: (url: string) => void;
}) {
  if (roaster.count === 0) {
    return (
      <a
        href={roaster.website}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium whitespace-nowrap text-gray-400 dark:text-gray-500 hover:underline underline-offset-[3px]"
      >
        {roaster.name}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(roaster.url)}
      className="font-medium whitespace-nowrap hover:underline underline-offset-[3px]"
    >
      {roaster.name}
      <sup className="text-[10px] text-gray-400 ml-0.5 font-normal">{roaster.count}</sup>
    </button>
  );
}

export default function LetterGroup({
  group,
  openUrl,
  onToggle,
}: {
  group: RoasterLetterGroup;
  openUrl: string | null;
  onToggle: (url: string) => void;
}) {
  const open = group.roasters.find((r) => r.url === openUrl) ?? null;

  return (
    <div
      id={letterAnchorId(group.letter)}
      className="grid grid-cols-[40px_1fr] gap-4 py-3.5 border-t border-gray-100 dark:border-gray-800 scroll-mt-4"
    >
      <span className="text-xl font-light text-gray-300 dark:text-gray-600 leading-[22px]">
        {group.letter}
      </span>
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm leading-[22px]">
          {group.roasters.map((r) => (
            <RoasterName key={r.url} roaster={r} onToggle={onToggle} />
          ))}
        </div>
        {open && <RoasterPanel summary={open} onClose={() => onToggle(open.url)} />}
      </div>
    </div>
  );
}
