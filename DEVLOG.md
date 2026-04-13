## Development Log

### 2026-04-12
- Initialized project governance files (CLAUDE.md, MANIFEST.md, DEVLOG.md)
- No code changes
- Created AUDIT.md from codebase audit — 5 violations documented.

### 2026-04-13
- Refactored `src/app/owner/feeds/page.tsx` from 547-line monolith into 15 focused modules (5 hooks, 9 components, 1 pure-function lib)
- New files in `src/components/owner-feeds/`, `src/lib/feedFilters.ts`, types added to `src/lib/types.ts`
- Page.tsx is now a 46-line orchestrator; all functions ≤50 lines
- Gotcha: `useOwnerActions` had to be split into `useOwnerActions` + `useOwnerCron` — shared `setStatusMessage` threaded via params to stay under 50-line limit

### 2026-04-13
- Fixed swallowed errors in coffee API route and useCoffeeData hook (AUDIT.md #2)
- `src/app/api/coffees/route.ts`: both catch blocks now log via `logger.error` before returning fallback data
- `src/hooks/useCoffeeData.ts`: empty catch block now logs via `logger.warn`
- No behavior change — fallback/keep-data strategy preserved, errors are now observable

### 2026-04-13
- Eliminated shared mutable state in `src/lib/sources.ts` (AUDIT.md #3)
- `sources.ts`: converted 7 exported functions over 2 module-level variables into a `createInMemoryStore()` factory; all state lives in closure
- `sourceStore.ts`: owns the singleton store privately; added `getSourceHealth()`/`setSourceHealth()` to centralize health data access
- Route files (`coffees/route.ts`, `admin/sources/route.ts`, `sources/route.ts`) no longer import from `sources.ts` — all access goes through `sourceStore`
- No behavior change — same lazy-load, same cross-request persistence in dev
