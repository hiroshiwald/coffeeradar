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

### Commands executed
- `pwd && rg --files -g 'AGENTS.md'`
- `find .. -maxdepth 3 -name AGENTS.md`
- `rg --files | head -n 200`
- `sed -n '1,220p' src/app/admin/page.tsx`
- `sed -n '1,260p' src/app/page.tsx`
- `sed -n '1,260p' src/app/api/sources/route.ts`
- `sed -n '1,260p' src/lib/sources.ts`
- `sed -n '1,320p' src/lib/db.ts`
- `sed -n '1,260p' src/app/api/coffees/route.ts`
- `sed -n '1,260p' src/app/api/cron/route.ts`
- `rg -n "admin|auth|middleware|sources.json|csv|owner|CRON_SECRET|TURSO|feed" src package.json README.md docs -g '!node_modules'`
- `sed -n '170,250p' src/components/CoffeeTable.tsx`

### Planned implementation approach (pending user approval)
1. Add owner-only protection middleware for an admin namespace route.
2. Move admin UI under a non-public path and remove direct public-page link.
3. Migrate source-of-truth feed sources from in-memory JSON to DB-backed master table with CRUD APIs.
4. Add feed auto-discovery service that takes store URL and attempts to locate/validate RSS/Atom feed URL(s).
5. Add CSV export endpoint for current master feed list.
6. Keep/verify 30-day retention with explicit scheduled pruning and coverage for related feed health data.
7. Validate flows manually and with lightweight checks.

### Status
- No functional implementation yet.
- Waiting for explicit user approval before coding the feature work.

## 2026-04-06 — Password protection: root cause finally identified

### Problem history
PRs #9 through #20 (12 attempts!) tried to fix "password not working." Each addressed
a real secondary issue but none fixed the actual bug. Issues fixed along the way:
- Edge Runtime incompatibility (#10, #11)
- Stale caches and cache-busting (#12, #13)
- Direct Turso query instead of self-fetch (#14)
- Protection check fallback for Edge middleware (#15, #16)
- In-memory store actions (#17)
- Local persistence and fallback (#18)
- Env var check replacing dynamic DB check (#20)

### Actual root cause (identified in this session)
**The login form could never succeed because no valid credentials existed.**

The auth system has TWO separate credential stores:
1. `OWNER_USERNAME` / `OWNER_PASSWORD` env vars → used ONLY for HTTP Basic Auth
   on `/owner/*` and `/api/admin/*` routes (middleware.ts)
2. `site_users` store (DB table or `data/local-auth.json`) → used by the login
   form at `/login` via `POST /api/auth/login` → `validateSiteUser()`

When `SITE_PROTECTION_ENABLED=true`, middleware redirects to `/login`. The user
enters their OWNER_PASSWORD. But `validateSiteUser()` only checks the `site_users`
store, which is EMPTY (no `local-auth.json` file, no DB rows). Login always fails
with "Invalid credentials" regardless of what is entered.

Creating site users requires the admin panel (`/owner/feeds`) which uses Basic Auth
(OWNER_PASSWORD) — a completely different auth mechanism. Chicken-and-egg problem.

### Fix applied (commit 045897e)
`src/lib/siteAuthStore.ts` → `validateSiteUser()` now falls back to checking
`OWNER_USERNAME`/`OWNER_PASSWORD` env vars when no matching site user is found.
The admin can always log in with owner credentials.

### Also applied (commit e5d7149)
Defense-in-depth hardening (was the originally requested fix, but not the root cause):
- `middleware.ts`: try/catch wrapper (fail-closed on exceptions)
- `src/lib/authGuard.ts`: shared auth utility for server components and API routes
- `src/app/page.tsx`: server-side auth check + `force-dynamic`
- `src/app/api/coffees/route.ts`: route-level auth guard
- `src/app/api/sources/route.ts`: route-level auth guard
- `src/lib/session.ts`: `getSecret()` throws in production without secrets
- `src/hooks/useCoffeeData.ts`: 401 → redirect to /login
- `src/lib/__tests__/authGuard.test.ts`: fail-closed tests
- `.env.example`: documents required env vars

### DEEPER root cause (also identified this session, after screenshot of Vercel env vars)
The middleware ALSO never ran its protection logic because `SITE_PROTECTION_ENABLED`
was never set in Vercel environment variables. Only TURSO_DATABASE_URL, TURSO_AUTH_TOKEN,
and DATABASE_URL vars were configured. The middleware gate at line 62:
  `process.env.SITE_PROTECTION_ENABLED === "true"` → `undefined === "true"` → false
...caused every request to pass through. All 12 PRs changed code behind this gate.

### Final fix
Changed protection logic to auto-enable when `OWNER_PASSWORD` is set:
- `middleware.ts`: `!!process.env.OWNER_PASSWORD && process.env.SITE_PROTECTION_ENABLED !== "false"`
- `src/lib/authGuard.ts`: same logic in `isProtectionEnabled()`
- No separate toggle needed. Set OWNER_PASSWORD → site is protected.
- To explicitly disable: set `SITE_PROTECTION_ENABLED=false`

### User must add to Vercel Environment Variables
- `OWNER_USERNAME` — login username
- `OWNER_PASSWORD` — login password (also enables site protection)
- `SESSION_SECRET` — random 32+ char string for session signing

### Key lesson for future sessions
**ALWAYS trace the actual user action end-to-end before fixing infrastructure.**
Check env vars first. Check the deployment config. Read the DEVLOG before starting.
The middleware code was fine — the env var it depended on was never set.

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

### Commands executed
- `mkdir -p src/app/api/admin/sources src/app/api/admin/sources/csv`
- `mkdir -p src/app/owner/feeds`
- `npm run build`

### Build result
- `npm run build` passed.
- Existing warning remains in repository config: unrecognized `serverExternalPackages` key in `next.config.mjs` (pre-existing).
