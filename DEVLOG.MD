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

---

## 2026-04-08 — Two-step triage for failed feeds

### Scope
Replace the old "Rescan failed feeds" behavior (which just re-ran the
autodiscovery path from `feedDiscovery.ts` and produced a binary
"candidate found" / "no candidate" outcome) with a richer two-step
triage pipeline that classifies each failing source into one of three
actionable states: `recommend_add`, `recommend_deletion`, or
`manual_review`. Admin panel UI extended to render all three.

### Spec implemented
Per failing source:

1. **Step 1 — site alive check.** GET the roaster's root URL with
   `redirect: "follow"` and the existing `FEED_TIMEOUT_MS` (5s). A site
   is dead on:
   - `fetch` throwing (DNS failure, network error, timeout/abort).
   - Status `404`, `410`, `451`.
   - Persistent `5xx` (cron has already retried).
   - Redirect to an unrelated registrable domain (cheap `www.`-strip +
     lowercased host compare — PSL-correct solution deferred).
   Status `401`/`403` is treated as "alive but gated" and falls through
   to manual review.

2. **Step 2 — feed reconstruction** (alive only). Build up to 12
   candidate product-listing pages from:
   - Spec-ordered static paths: `/collections/all`, `/collections/coffee`,
     `/collections/coffees`, `/shop`, `/products`, `/store`.
   - Anchors crawled from the root HTML whose visible text / aria-label /
     title contains any of: `all coffees`, `coffees`, `shop`, `products`,
     `collections`. Off-domain anchors filtered out, fragments stripped,
     candidates deduped while preserving order.

   For each candidate product page, probe feed URLs in order by
   appending `.atom`, `.rss`, `/feed`, `/rss`, `/atom`. Each probe does
   HEAD first (fast reject on wrong content-type), then GET. A feed is
   accepted only when:
   - HTTP 200 on GET.
   - `Content-Type` header contains `xml`, `rss`, or `atom`
     (case-insensitive substring — handles `application/atom+xml;
     charset=utf-8`).
   - Body parses with `fast-xml-parser` AND has ≥1 `feed.entry` (Atom),
     `rss.channel.item` (RSS), or `rdf:RDF.item` (RDF). Handles
     single-vs-array children.
   Short-circuits on first valid feed.

3. **Classification:**
   - `siteAlive = false` → `recommend_deletion`.
   - Alive + feed found → `recommend_add` with `discoveredFeedUrl` and
     `discoveredWebsite`.
   - Alive + no feed after all probes → `manual_review`.

Deliberately does **not** call `validateFeedUrl` from `feedValidator.ts`
— that helper additionally requires a non-merch coffee entry via
`heuristics.ts`, which is stricter than the spec (which only requires
≥1 entry/item). Using the stricter check would under-count feeds for
roasters that just launched.

### Files
- `src/lib/feedTriage.ts` (new, ~370 lines) — pure module, no DB. Public
  API: `triageFailedFeed(source)`, `triageFailedFeeds(sources, concurrency=5)`,
  `TriageStatus`, `TriageResult`.
- `src/lib/__tests__/feedTriage.test.ts` (new, ~270 lines) — 12 cases
  covering all three outcomes, offsite redirect, www-redirect treated as
  alive, 5xx, wrong content-type rejection, empty-feed rejection, anchor
  crawl with off-domain filter, short-circuit on first hit, and a batch
  ordering test. All green.
- `src/app/api/admin/sources/route.ts` — `rescan_failed` now calls
  `triageFailedFeeds` instead of `suggestReplacementsForFailed`. New
  `delete_dead_source` action for the dead-site button (removes source
  and deletes the suggestion atomically). Existing
  `approve_suggestion` / `dismiss_suggestion` actions unchanged and
  still work for `recommend_add` / `manual_review`.
- `src/app/owner/feeds/page.tsx` — the suggestion-card block now
  branches on `suggestion.reason`:
  - `recommend_add` → green "Recommend add: discovered working feed"
    card with the existing Approve & replace button.
  - `site_dead` → red "Recommend deletion: site appears dead" card
    with a new Delete source button (behind `window.confirm`).
  - `manual_review` → gray "Manual review needed" card with Dismiss.
  - Fallback → legacy amber card preserved for any pre-existing
    `feed_suggestions` rows from the old pipeline.
  The "Rescan failed feeds" button's status message now reads
  `"Triaged N failed feeds: X recommend add, Y recommend deletion,
  Z manual review."`
- `scripts/triage-failed-feeds.ts` (new) — read-only verification
  script. Run via `TURSO_DATABASE_URL=... npx tsx
  scripts/triage-failed-feeds.ts [limit]` to triage up to `limit`
  real failing sources from the DB and print a JSON table + summary
  counts. Not run in this session (no Turso credentials in sandbox).

### DB schema
**Unchanged.** The existing `feed_suggestions` table is reused by
mapping triage outcomes onto existing columns:

| Triage status         | `suggested_feed_url` | `suggested_website` | `preflight_ok` | `reason`          |
|-----------------------|----------------------|---------------------|----------------|-------------------|
| `recommend_add`       | discovered URL       | discovered website  | `1`            | `recommend_add`   |
| `recommend_deletion`  | `null`               | `null`              | `0`            | `site_dead`       |
| `manual_review`       | `null`               | `null`              | `0`            | `manual_review`   |

No migration required.

### Files NOT touched (per constraints)
- `src/lib/feedDiscovery.ts` — existing autodiscovery, frozen.
- `src/lib/feedSuggestion.ts` — kept importable; no longer wired into
  `rescan_failed` but tests still pass.
- `src/lib/feedFetcher.ts`, `src/app/api/cron/route.ts` — failure-marking
  pipeline, frozen.
- `src/lib/db.ts` schema — no new columns.

### Test status
- Full Vitest suite: **174/176 passing**. The 2 failures
  (`heuristics.test.ts`, `feedParser.test.ts`) are pre-existing on
  `main` and unrelated to this feature (verified via `git stash` +
  rerun). They concern flavor-note extraction ("Chocolate" vs
  "Dark Chocolate") and are not touched by this change.
- `tsc --noEmit` clean.
- `next build` succeeds with no new warnings.

### Known risks flagged during planning
1. **5xx handling is aggressive.** Persistent 5xx at triage time is
   classified as `recommend_deletion`. An alternative (downgrade to
   `manual_review:transient_error`) would be more conservative but
   produces more admin noise. Current default: the cron has already
   retried, so a persistent 5xx is usually real.
2. **Off-domain redirect detection is heuristic.** Any cross-
   registrable-domain redirect (after `www.`-strip) is flagged as
   `recommend_deletion`. False positives are possible when a roaster
   legitimately moves to `shop.myshopify.com` or similar. A PSL-based
   comparison + a parking-sentinel allowlist (`parking`, `sedoparking`,
   `hugedomains`, `godaddy`) would reduce this; deferred. Admins can
   dismiss false positives with one click.
3. **HTTP request fan-out.** Worst case per source is ~1 (root) + 12
   (product pages) × 5 (suffixes) × up to 2 (HEAD then GET) ≈ 90 fetches.
   With concurrency 5 that's bursty but short-circuits on first hit. Not
   intended for per-cron-tick invocation; admin-triggered only.
4. **No 200KB body cap** before XML parsing. A malicious HTML-as-XML
   response could slow the parser; mitigated in practice by the 5s
   fetch timeout and the content-type gate.
5. **`feed_suggestions.reason` encoding drift.** The old pipeline wrote
   values like `"http_error"`, `"ok"`, `"no_candidate_found"`. The new
   pipeline writes `"recommend_add"`, `"site_dead"`, `"manual_review"`.
   The UI's fallback branch still renders any unrecognized `reason`
   value, so mixed rows are handled gracefully during rollout.

### Commit
- `6c86e6c` — Add two-step triage for failed feeds. Branch:
  `claude/retry-failed-feeds-zf5vP`.

### Follow-ups
- Verify against 3–5 real failing feeds via
  `scripts/triage-failed-feeds.ts` (requires Turso credentials).
- Consider downgrading persistent 5xx to `manual_review` if admin
  deletion recommendations turn out to be noisy in practice.
- Consider adding a parking-sentinel allowlist or a PSL-based
  registrable-domain comparison (`tldts` dep) to reduce off-domain
  redirect false positives.
- Optional: cap XML parser input at 200KB as defense-in-depth.

---

## 2026-04-09 — Fix coffees excluded from /api/coffees response

### Bug
Valid coffees present in the Turso `coffees` table were excluded from
the `/api/coffees` API response (696 shown vs. more in DB). Example:
Dayglow "Pastel Hour" ($33, Washed) existed in the database but was
not displayed on the site.

### Root cause
The `date` column in the `coffees` table stores the RSS/Atom
**publication date** — the date the product was first added to the
store, which can be months old for long-running listings. Three layers
of 30-day filtering used this column:

1. `getCoffees()` in `src/lib/db.ts`: SQL `WHERE date >= datetime('now',
   '-30 days')` — lexicographic string comparison against publication
   dates, which fails for non-ISO formats and excludes valid old listings.
2. `cleanOldEntries()` in `src/lib/db.ts`: `DELETE FROM coffees WHERE
   date < datetime('now', '-30 days')` — same issue.
3. `fetchAllFeeds()` in `src/lib/feedFetcher.ts`: application-level
   filter that rejected entries with parseable dates >30 days old but
   inconsistently passed entries with unparseable dates (`!d`/NaN
   check).

After PRs #29–#30 introduced feed source triage (enable/disable
sources), disabled sources stopped being re-fetched. Their coffees
were never re-upserted, so `created_at` was never refreshed, and the
coffees aged out of the 30-day window.

**No JOINs** against `feed_health`, `feed_sources`, or
`feed_suggestions` existed — the initial hypothesis was incorrect.

### Fix
Switched the retention/visibility filter from `date` (publication
date) to `created_at` (ingestion/last-seen timestamp). The
`created_at` column already existed on the `coffees` table with
`DEFAULT (datetime('now'))` and is reset on every `INSERT OR REPLACE`,
making it an effective "last seen in feed" timestamp.

1. **`src/lib/db.ts` — `getCoffees()`**: changed filter and sort from
   `date` to `created_at`.
2. **`src/lib/db.ts` — `cleanOldEntries()`**: changed deletion filter
   from `date` to `created_at`.
3. **`src/lib/db.ts` — `initDb()`**: added
   `idx_coffees_created_at` index.
4. **`src/lib/feedFetcher.ts`**: removed the 30-day application-level
   date filter entirely. Feeds naturally limit their output; the DB
   layer handles retention via `created_at`.
5. **`src/lib/constants.ts`**: removed unused `THIRTY_DAYS_MS`.
6. **`src/lib/__tests__/feedFetcher.test.ts`**: updated test — entries
   with old publication dates are now included.

### What did NOT change
- The `date` field still stores the publication date (used for display
  and stable ID generation via `buildStableId()`).
- The `CoffeeEntry` type is unchanged.
- Front-end sorting by date still uses the publication date.
- No schema migration needed.

---

## 2026-04-09 — Fix stale RSS content from Next.js Data Cache

### Bug
The cron job reported 816 items "inserted" but no Apr 9 coffees
appeared — all entries were dated Apr 8 or older. The feed fetcher
was re-upserting stale cached XML on every run, not fresh feed
content.

### Root cause
Next.js 14 extends the global `fetch()` with aggressive caching by
default (the "Data Cache"). Every `fetch()` call in a server context
is cached indefinitely unless opted out. The `fetch()` calls in the
feed pipeline lacked a `cache` directive, so Next.js served cached
responses for every RSS/Atom feed URL. The 816 "insertions" were
`INSERT OR REPLACE` re-upserts of identical stale XML, producing no
new coffees.

### Fix
Added `cache: "no-store"` to every `fetch()` call that retrieves
external RSS/Atom feed or web content:

1. **`src/lib/feedFetcher.ts`** — `fetchOne()`: the primary feed
   fetch path used by cron and manual refresh.
2. **`src/lib/feedTriage.ts`** — `safeFetch()`: used by the two-step
   triage pipeline (site alive check + feed probing).
3. **`src/lib/feedValidator.ts`** — `fetchWithTimeout()`: used by
   feed validation during suggestion approval.
4. **`src/lib/feedDiscovery.ts`** — `fetchText()`: used by feed
   auto-discovery when adding a source by store URL.

---

## 2026-04-09 — Fix INSERT OR REPLACE resetting created_at on cron upsert

### Bug
Coffee count inflated to 3,142. The 30-day cleanup
(`cleanOldEntries`) never removed rows, and `getCoffees()` returned
every coffee ever scraped instead of only those first seen within the
last 30 days.

### Root cause
`upsertCoffees()` used `INSERT OR REPLACE`, which internally deletes
the existing row and inserts a new one. Because `created_at` has
`DEFAULT (datetime('now'))` and was not in the upsert column list, it
was reset to "now" on every cron run. This turned `created_at` into a
"last seen" timestamp rather than "first seen," so nothing ever aged
past the 30-day window.

### Fix
Changed the SQL in `upsertCoffees()` from `INSERT OR REPLACE` to
`INSERT ... ON CONFLICT(id) DO UPDATE SET ...` with an explicit
`created_at = coffees.created_at` clause:

1. **`src/lib/db.ts` — `upsertCoffees()`**: replaced
   `INSERT OR REPLACE` with `INSERT ... ON CONFLICT(id) DO UPDATE SET`
   listing all mutable columns and preserving `created_at` via
   `created_at = coffees.created_at`.

For new rows, `DEFAULT (datetime('now'))` still applies, giving a true
"first seen" date. No schema migration needed.

### What did NOT change
- The `chunkedBatchInsert` helper is unchanged — it accepts any SQL
  string.
- The `toArgs` callback produces the same 11 values in the same order.
- No schema migration needed — `id TEXT PRIMARY KEY` is already the
  conflict target.
- Display and cleanup queries (already using `created_at`) work
  correctly now that existing rows keep their original timestamp.
