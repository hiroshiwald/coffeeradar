# DEVLOG

## 2026-04-01 — Planning pass for admin hardening and feed-master workflow

### User request summary
- Move feed editing/admin controls off the public feed page path.
- Protect admin for owners only.
- Make admin control the canonical (MASTER) source list used by public site.
- Add source by entering store URL and attempting auto-feed discovery.
- Allow feed list export as CSV.
- Ensure only prior 30 days of feeds/data are retained.
- Provide a plan and get approval before implementation.

### Repository reconnaissance performed
- Identified current admin page at `/admin` (`src/app/admin/page.tsx`) with add/toggle/remove controls.
- Found public page links directly to admin via a header icon (`src/components/CoffeeTable.tsx`).
- Found `/api/sources` endpoint currently unauthenticated and in-memory backed via `src/lib/sources.ts` loaded from `data/sources.json`.
- Confirmed DB retention logic exists for `coffees` table via `cleanOldEntries()` and `getCoffees()` date filter in `src/lib/db.ts`, but sources are not persisted in DB.
- Confirmed cron and refresh paths call pruning (`src/app/api/cron/route.ts`, `src/app/api/coffees/route.ts`).

### Planned implementation approach (pending user approval)
1. Add owner-only protection middleware for an admin namespace route.
2. Move admin UI under a non-public path and remove direct public-page link.
3. Migrate source-of-truth feed sources from in-memory JSON to DB-backed master table with CRUD APIs.
4. Add feed auto-discovery service that takes store URL and attempts to locate/validate RSS/Atom feed URL(s).
5. Add CSV export endpoint for current master feed list.
6. Keep/verify 30-day retention with explicit scheduled pruning and coverage for related feed health data.
7. Validate flows manually and with lightweight checks.

### Status
- Waiting for explicit user approval before coding the feature work.

## 2026-04-01 — Implementation after approval

### Implemented
- Moved owner feed admin UI from `/admin` to `/owner/feeds`.
- Added middleware-based Basic Auth protection for `/owner/*` and `/api/admin/*` using `OWNER_USERNAME` / `OWNER_PASSWORD`.
- Added DB-backed `feed_sources` master table with seed import from `data/sources.json` on first run.
- Refactored source reads/writes through `src/lib/sourceStore.ts` to use DB in Turso and memory fallback locally.
- Updated feed fetch pipeline to use enabled master sources from the new store abstraction.
- Added owner API endpoints:
  - `GET/POST /api/admin/sources`
  - `GET /api/admin/sources/csv`
- Added feed discovery helper (`src/lib/feedDiscovery.ts`) to discover feed URL from roaster store URL using HTML autodiscovery + common feed paths.
- Updated owner admin UI to support:
  - Quick add by store URL (auto-discovery)
  - Manual add by feed URL
  - CSV download
- Made legacy `/api/sources` read-only (no public mutating actions).
- Extended retention cleanup to delete old `feed_results` rows (>30 days) along with old coffee rows.

### Build result
- `npm run build` passed.
- Existing warning remains in repository config: unrecognized `serverExternalPackages` key in `next.config.mjs` (pre-existing).

## 2026-04-01 through 2026-04-05 — Password protection attempts (PRs #9–#20)

### Summary
12 PRs attempted to fix "password not working" after site protection was added in PR #9.
Each addressed a real secondary issue but none fixed the actual root cause.

### Issues fixed along the way
- PR #9: Initial site password protection with admin-managed users
- PR #10: Edge Runtime incompatibility with password hashing
- PR #11: Edge/Node runtime mismatch causing bypass
- PR #12: Required persistent auth storage
- PR #13: Removed stale caches, added cache-busting to middleware check
- PR #14: Replaced self-fetch with direct Turso query
- PR #15: Protection check fallback for Edge middleware
- PR #16: Site protection fallback state sync across runtimes
- PR #17: Allowed site auth admin actions with in-memory store
- PR #18: Fixed local site protection persistence and fallback checks
- PR #19: Refactored CoffeeTable into testable modules, added Vitest test suite (109 tests)
- PR #20: Replaced dynamic DB check with env var for protection status

### Why none of these fixed the problem
Two root causes were missed by every attempt:

1. **Login could never succeed.** The login form validated against a `site_users` store
   (DB or `data/local-auth.json`) which was always empty. `OWNER_USERNAME`/`OWNER_PASSWORD`
   were only used for Basic Auth on admin routes — the login form never checked them.
   Chicken-and-egg: you need to be logged in to create users, but you can't log in without users.

2. **Middleware protection never activated.** The middleware checked
   `process.env.SITE_PROTECTION_ENABLED === "true"` but this env var was never added to
   Vercel. Only `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `DATABASE_URL` were configured.
   The gate evaluated to `false` and every request passed through. All 12 PRs changed code
   behind this gate that never executed.

## 2026-04-06 — Password protection: root cause identified and fixed

### Root cause 1: Login form had no valid credentials
The auth system had two separate credential stores:
1. `OWNER_USERNAME` / `OWNER_PASSWORD` env vars — used ONLY for HTTP Basic Auth
   on `/owner/*` and `/api/admin/*` routes (middleware.ts)
2. `site_users` store (DB table or `data/local-auth.json`) — used by the login
   form at `/login` via `POST /api/auth/login` → `validateSiteUser()`

When protection was enabled, middleware redirected to `/login`. The user entered their
owner password. But `validateSiteUser()` only checked the `site_users` store, which was
empty. Login always failed with "Invalid credentials."

**Fix:** `src/lib/siteAuthStore.ts` → `validateSiteUser()` now falls back to checking
`OWNER_USERNAME`/`OWNER_PASSWORD` env vars when no matching site user is found. The
owner can always log in.

### Root cause 2: SITE_PROTECTION_ENABLED was never set in Vercel
Confirmed via screenshot of Vercel Environment Variables dashboard — only database vars
were configured. The middleware gate:
```
process.env.SITE_PROTECTION_ENABLED === "true" → undefined === "true" → false
```
...caused every request to pass through unprotected.

**Fix:** Changed protection logic to auto-enable when `OWNER_PASSWORD` is set:
- `middleware.ts`: `!!process.env.OWNER_PASSWORD && process.env.SITE_PROTECTION_ENABLED !== "false"`
- `src/lib/authGuard.ts`: same logic in `isProtectionEnabled()`
- `src/app/api/admin/site-auth/route.ts`: same logic for admin panel status badge
- No separate `SITE_PROTECTION_ENABLED` toggle needed. Set `OWNER_PASSWORD` → site is protected.
- To explicitly disable: set `SITE_PROTECTION_ENABLED=false`.

### Defense-in-depth hardening also applied
- `middleware.ts`: Wrapped in try/catch — exceptions redirect to `/login` or return 401 (fail-closed)
- `src/lib/authGuard.ts`: New shared auth utility for server components and API routes (fail-closed)
- `src/app/page.tsx`: Server-side auth check + `export const dynamic = "force-dynamic"` (prevents static generation)
- `src/app/api/coffees/route.ts`: Route-level auth guard
- `src/app/api/sources/route.ts`: Route-level auth guard
- `src/lib/session.ts`: `getSecret()` throws in production if no `SESSION_SECRET` or `OWNER_PASSWORD`
- `src/hooks/useCoffeeData.ts`: Client detects 401 → redirects to `/login`
- `src/lib/__tests__/authGuard.test.ts`: Tests for all auth scenarios including fail-closed on crypto errors
- `.env.example`: Documents all required env vars

### Admin panel updated
- Status badge and API endpoint now use the new auto-enable logic
- UI text changed from "Controlled by `SITE_PROTECTION_ENABLED` env var" to
  "Automatically enabled when `OWNER_PASSWORD` is set"

### User action required
Add to Vercel Environment Variables (All Environments):
- `OWNER_USERNAME` — login username (you choose this)
- `OWNER_PASSWORD` — login password (you choose this; also enables site protection)
- `SESSION_SECRET` — random 32+ character string for session signing

Then redeploy.

### Commits on branch `claude/fix-password-middleware-6k7Fx`
1. `e5d7149` — Harden auth to fail-closed with defense-in-depth
2. `045897e` — Fix login: fall back to owner credentials when no site users exist
3. `a797aa8` — Auto-enable site protection when OWNER_PASSWORD is set
4. `8ccca33` — Update admin panel to reflect auto-enable protection logic

### Key lessons for future sessions
- **ALWAYS read the DEVLOG before starting.** This would have prevented 12 redundant fix attempts.
- **ALWAYS trace the actual user action end-to-end before fixing infrastructure.** Nobody followed the login POST to see that `validateSiteUser()` was checking an empty store.
- **ALWAYS check env vars in the deployment environment.** The middleware code was correct — the env var it depended on was never set.
- **Update the DEVLOG with findings.** Each session that fails to record its diagnosis forces the next session to start from scratch.

---

## 2026-04-07 — Broad refactor + test plan

### Scope
A cleanup pass after the 2026-04 auth hardening. Goals:
- Cut down a 319-line `CoffeeTable.tsx` and a 302-line `feedParser.ts`.
- Remove `any` types from `siteAuth.ts`.
- Stop swallowing errors silently in feed parsing/discovery.
- Dedupe chunked batch inserts in `db.ts`.
- Stop calling `initDb()` on every read in `sourceStore.ts`.
- Drop the `globalThis`-style cache in `/api/coffees`.
- Add new unit tests and a written test plan.

### Phases
- **A — leaf utilities.** Added `lib/logger.ts` (silent under Vitest).
  Extracted constants from `heuristics.ts` into `lib/heuristicsData.ts`.
  Split `extractNotes` into `tokenizeNotesSegment`,
  `filterNoiseTokens`, `normalizeNoteCase`, plus three small `collect*`
  helpers; the public `extractNotes` is now a short orchestrator.
  Added `lib/feedParserHelpers.ts` with `decodeHtml`, `deepString`,
  `deepText`, `extractImage*`, `extractShopifyTags`,
  `extractProductType`, `extractShopifyPrice`. `feedParser.ts` now just
  selects entries and maps them through the helpers, and routes
  parse failures through `logger.warn` instead of `catch {}`.
- **B — db / storage.** Added a generic `chunkedBatchInsert<T>` helper
  in `db.ts` and used it from both `upsertCoffees` and
  `saveFeedResults`. Memoized `initDb()` in `sourceStore.ts` via a
  module-scoped `initPromise` (with `__resetSourceStoreInitForTests`
  for tests). Replaced all four `any` casts in `siteAuth.ts` with a
  proper `AuthData` interface and an `isAuthData` type guard.
- **C — api / observability.** Renamed the `globalCache` in
  `/api/coffees` to a clearly module-scoped `localCache` with a
  documented TTL constant. Wired `feedDiscovery.ts` to log
  fetch failures and invalid feed XML through `logger.warn`.
- **D — component split.** Created `src/components/coffee-table/`
  with `useCoffeeFilters.ts`, `CoffeeTableFilters.tsx`,
  `CoffeeTableHeader.tsx`, `CoffeeTableRow.tsx`. `CoffeeTable.tsx`
  shrunk from 319 lines to a thin orchestrator that wires the data
  hook to those sub-components. The default export and the
  `@/components/CoffeeTable` import path are unchanged, so no callers
  needed updates.

### Behavior delta
None intended. The only user-visible change is the rename of the
local-dev cache variable in `/api/coffees`; semantics are identical.

### New tests
+45 tests across five files, all green alongside the existing 109:

- `src/lib/__tests__/feedParserHelpers.test.ts` — image / price /
  text helpers, with fixtures for s:image, media:content,
  media:thumbnail, itunes:image, and HTML scrape fallback.
- `src/lib/__tests__/heuristicsHelpers.test.ts` — tokenize, filter,
  normalize.
- `src/lib/__tests__/db.test.ts` — `chunkedBatchInsert`: empty,
  exact-multiple, ragged, and error-propagation cases against a fake
  client.
- `src/lib/__tests__/sourceStore.test.ts` — verifies `initDb` is called
  exactly once across parallel reads, and again after the test reset
  helper.
- `src/lib/__tests__/siteAuth.test.ts` — `isAuthData` type guard.

`npm test` reports 14 files / 154 tests passing. `npx tsc --noEmit`
is clean.

### Docs
- `README.md` — repository map updated to list the new
  `coffee-table/` directory and the new `lib/` files; testing section
  links to `TEST_PLAN.md`.
- `TEST_PLAN.md` (new) — coverage matrix, refactor-specific
  assertions, manual e2e smoke checklist, known gaps.

### Follow-ups
- Component tests for `CoffeeTable*` (needs `jsdom` +
  `@testing-library/react`).
- API route test for `/api/coffees` (mock `getCoffees`,
  `fetchAllFeeds`, assert local cache TTL).
- Playwright e2e covering the first 5 smoke steps in `TEST_PLAN.md`.
- Add coverage gating to CI once the above land.
