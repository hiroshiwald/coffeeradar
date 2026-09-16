"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ApiResponse, FeedSource } from "@/lib/types";
import { useCoffeeData } from "@/hooks/useCoffeeData";
import {
  summarizeRoasters,
  countActive,
  groupByLetter,
  RoasterSummary,
} from "@/lib/roasterSummary";
import LetterGroup, { letterAnchorId } from "./roasters/LetterGroup";
import Footer from "./Footer";

// Set NEXT_PUBLIC_SUGGEST_EMAIL to show the suggestion link. The literal must
// appear here so Next.js inlines it into the client bundle at build time.
const SUGGEST_EMAIL = process.env.NEXT_PUBLIC_SUGGEST_EMAIL;

/**
 * Line under the heading.
 *
 * `useCoffeeData` keeps the last good payload and exposes no error flag, so a
 * failed fetch leaves `data` null with `loading` false. Reporting "0 released"
 * there would state a count we do not have, so that case says so instead. No
 * date arithmetic: `fetchAllFeeds` and `getCoffees` already trim to 30 days, so
 * having any coffee at all is the whole definition of active.
 */
function subtitle(
  summaries: RoasterSummary[],
  data: ApiResponse | null,
  loading: boolean,
): string {
  const total = `${summaries.length} roasters.`;
  if (data) return `${total} ${countActive(summaries)} released something in the last 30 days.`;
  if (loading) return `${total} Loading recent releases…`;
  return `${total} Recent releases could not be loaded.`;
}

function LetterNav({ letters }: { letters: string[] }) {
  return (
    <div className="flex flex-wrap gap-0.5 mb-6 text-xs font-mono">
      {letters.map((letter) => (
        <a
          key={letter}
          href={`#${letterAnchorId(letter)}`}
          className="px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          {letter}
        </a>
      ))}
    </div>
  );
}

function IndexHeader({
  summaries,
  data,
  loading,
}: {
  summaries: RoasterSummary[];
  data: ApiResponse | null;
  loading: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Roasters</h1>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          ← Back
        </Link>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {subtitle(summaries, data, loading)}
      </p>

      {SUGGEST_EMAIL && (
        <a
          href={`mailto:${SUGGEST_EMAIL}?subject=Roaster suggestion`}
          className="inline-block mt-1 mb-5 text-xs underline underline-offset-2 text-gray-500 dark:text-gray-400"
        >
          Suggest a roaster
        </a>
      )}
    </>
  );
}

export default function RoasterIndex({ sources, tipUrl }: { sources: FeedSource[]; tipUrl: string | null }) {
  const { data, loading } = useCoffeeData();
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  // Memoized because it joins every source against every coffee and sorts each
  // match. Without this it would rerun on every panel open and close.
  const summaries = useMemo(
    () => summarizeRoasters(sources, data?.coffees ?? []),
    [sources, data],
  );
  const groups = useMemo(() => groupByLetter(summaries), [summaries]);

  function toggle(url: string) {
    setOpenUrl((current) => (current === url ? null : url));
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <IndexHeader summaries={summaries} data={data} loading={loading} />

      <LetterNav letters={groups.map((g) => g.letter)} />

      <div className="flex flex-col">
        {groups.map((group) => (
          <LetterGroup
            key={group.letter}
            group={group}
            openUrl={openUrl}
            onToggle={toggle}
          />
        ))}
      </div>

      <Footer tipUrl={tipUrl} />
    </main>
  );
}
