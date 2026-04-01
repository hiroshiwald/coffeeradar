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
