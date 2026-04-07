import Link from "next/link";
import { redirect } from "next/navigation";
import { checkSiteAuth } from "@/lib/authGuard";
import { getFeedSources, hasTurso } from "@/lib/db";
import seedSources from "../../../data/sources.json";
import { FeedSource } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadRoasters(): Promise<FeedSource[]> {
  if (hasTurso()) {
    const sources = await getFeedSources(true);
    if (sources.length > 0) return sources;
  }
  return (seedSources as FeedSource[]).filter((s) => s.enabled !== false);
}

export default async function RoastersPage() {
  const { authorized } = await checkSiteAuth();
  if (!authorized) redirect("/login");

  const roasters = (await loadRoasters()).slice().sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Roasters</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {roasters.length} specialty roasters tracked by CoffeeRadar
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          ← Back
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roasters.map((r) => (
          <a
            key={r.url}
            href={r.website}
            target="_blank"
            rel="noopener noreferrer"
            className="group block px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition"
          >
            <p className="text-sm font-medium truncate">{r.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate group-hover:text-gray-600 dark:group-hover:text-gray-300 transition">
              {new URL(r.website).hostname.replace(/^www\./, "")}
            </p>
          </a>
        ))}
      </div>
    </main>
  );
}
