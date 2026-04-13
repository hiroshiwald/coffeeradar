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

### 2026-04-13
- Added input validation to admin API routes (AUDIT.md #4)
- `src/app/api/admin/sources/route.ts`: all 7 action handlers now validate types and shapes; URL inputs validated via `new URL()`; `remove` and `toggle` actions no longer pass unvalidated input to downstream functions
- `src/app/api/auth/login/route.ts`: username/password checked as strings, not just truthy
- `src/app/api/admin/site-auth/route.ts`: username/password/action checked as strings
- No behavior change for valid inputs; invalid inputs now return 400 with descriptive messages

### 2026-04-13
- Refactored `checkSiteAlive` and `triageFailedFeed` in `src/lib/feedTriage.ts` to comply with 50-line function limit (AUDIT.md #5)
- Extracted `classifyAfterRedirect` (post-redirect response classification) and `probeForWorkingFeed` (product page crawl + feed probing) as module-private helpers
- No export, interface, or test changes; all 12 existing tests pass unchanged
- Gotcha: status-check ordering is deliberate — hard-dead/5xx before redirect check, auth-gated after — split boundary preserves this

### 2026-04-13
- Audit compliance review: confirmed all 5 AUDIT.md fixes resolved; ran fresh full-codebase scan
- Created AUDIT-2.md with 5 new top violations (3 pre-existing function-length in route handlers and db.ts, 1 pre-existing in feedTriage, 1 introduced during Fix #5)
- Two minor issues introduced during Fix #1: fire-and-forget in useOwnerCron.ts:45, borderline 53-line SiteAccessControl component
- Updated MANIFEST.md with 15 new files from Fix #1 refactoring and updated module descriptions
- Gotcha: `probeForWorkingFeed` extracted from `triageFailedFeed` in Fix #5 is itself 55 lines — extraction moved the violation rather than eliminating it

### 2026-04-13
- Refactored POST handler in `src/app/api/admin/sources/route.ts` from 133-line monolith into 8 module-private handler functions + thin dispatcher (AUDIT-2.md #1)
- All functions ≤26 lines; POST dispatcher is 21 lines
- No export, interface, or response shape changes; pure mechanical extraction
- No new files created — all handlers remain in the same route file

### 2026-04-13
- Refactored `initDb` in `src/lib/db.ts` from 83-line monolith into 3 parts (AUDIT-2.md #2)
- Extracted `SCHEMA_DDL` module-level const (DDL strings), `createSchema(db)` (3 lines), `seedFeedSources(db)` (18 lines)
- `initDb()` is now a 5-line orchestrator; no export, signature, or caller changes
- No new files; all helpers are module-private

### 2026-04-13
- Refactored GET handler in `src/app/api/coffees/route.ts` from 73-line monolith into thin dispatcher + `handleWithDb` helper (AUDIT-2.md #3)
- GET is now 14 lines; `handleWithDb` is 43 lines — both under the 50-line limit
- Merged duplicate normal-read return branches (empty vs non-empty DB) into one using `isEmpty` flag
- No export, interface, or response shape changes; `handleWithDb` mirrors existing `handleWithoutDb` pattern

### 2026-04-13
- Refactored `crawlKeywordAnchors` in `src/lib/feedTriage.ts` from 58 to 45 lines (AUDIT-2.md #4)
- Extracted `anchorTextBlob` helper — combines visible text, aria-label, and title into a lowercase search blob
- No export, interface, or caller changes; all 12 feedTriage tests pass unchanged

### 2026-04-13
- Refactored `probeForWorkingFeed` in `src/lib/feedTriage.ts` from 55 to 43 lines (AUDIT-2.md #5)
- Extracted `buildAliveDiagnostics` helper — deduplicates identical 6-line diagnostics object in both return paths
- No export, interface, or caller changes; all 12 feedTriage tests pass unchanged

### 2026-04-13
- Audit cycle 3: confirmed all 5 AUDIT-2.md fixes resolved; ran fresh full-codebase scan
- Created AUDIT-3.md with 5 new top violations: uncaught `request.json()` in 3 routes, `fetchAllFeeds` 54-line triple-duty function, `middleware` 59 lines, `fetchOne` silent catch, async hooks lacking error handling
- 3 pre-existing (carried from prior notable mentions), 1 pre-existing (newly flagged middleware), 1 introduced during AUDIT.md Fix #1
- MANIFEST.md verified — no structural changes from AUDIT-2 fixes (all were internal refactorings with no export, file, or interface changes)
- Gotcha: `fetchAllFeeds` and `fetchOne` catch have been in Notable Mentions for two audit cycles without being fixed; promoted to top 5 this cycle

### 2026-04-13
- Wrapped `await request.json()` in try/catch in 3 POST handlers (AUDIT-3.md Violation #1)
- `src/app/api/auth/login/route.ts`: malformed JSON now returns 400 instead of unstructured 500
- `src/app/api/admin/site-auth/route.ts`: same fix
- `src/app/api/admin/sources/route.ts`: same fix
- No other logic changed; existing validation after parse is untouched

### 2026-04-13
- Added error handling to 3 async owner-panel hooks (AUDIT-3.md Violation #5)
- `src/components/owner-feeds/useOwnerAuth.ts`: wrapped `fetchSiteAuth` body in try/catch, errors logged via `console.error`
- `src/components/owner-feeds/useOwnerSources.ts`: wrapped `fetchSources` body in try/catch with `finally` for `setLoading(false)`, errors logged via `console.error`
- `src/components/owner-feeds/useOwnerCron.ts`: added `.catch()` to fire-and-forget `fetchSources()` call with detach comment
- No public API changes; network errors now log to console and fail gracefully to default state instead of crashing component tree

### 2026-04-13
- Added `logger.warn` to silent catch block in `fetchOne()` in `src/lib/feedFetcher.ts` (AUDIT-3.md Violation #4)
- Feed failures (DNS, timeout, TLS) now log source name, URL, and error via `logger` — previously invisible
- No behavior change — graceful degradation with `{ entries: [], ok: false }` preserved

### 2026-04-13
- Extracted deduplication logic from `fetchAllFeeds()` into module-private `deduplicateEntries` helper in `src/lib/feedFetcher.ts` (AUDIT-3.md Violation #2)
- `fetchAllFeeds()` reduced from 54 to 40 lines; deduplication logic unchanged, just relocated
- No export, interface, or behavior changes

### 2026-04-13
- Added CLAUDE.md 50-line exception comment to `middleware()` in `middleware.ts` (AUDIT-3.md Violation #3)
- Documents why the 59-line function is kept together: 5 route-class auth dispatch as single concern, intentional catch-block duplication for fail-closed safety
- No logic or structural changes
