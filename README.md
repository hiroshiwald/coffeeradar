# CoffeeRadar

CoffeeRadar is a Next.js app that aggregates recent coffee releases from specialty roasters by fetching and parsing RSS/Atom feeds, then displaying the results in a searchable, filterable UI.

## What it does

- Aggregates feed entries from a master source list of roasters.
- Parses and normalizes release data (coffee name, process, notes, price, image, link, date).
- Shows data in a responsive table with search, sorting, and filtering.
- Supports a protected owner admin area for managing feed sources.
- Supports either:
  - **Turso (libSQL)** for persisted data, or
  - **in-memory fallback** for local/dev use when Turso is not configured.

---

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI:** React + Tailwind CSS
- **Feed parsing:** `fast-xml-parser`
- **Database (optional):** Turso (`@libsql/client`)

---

## Architecture overview

### Data flow

1. Source list is loaded from the master source store (`sourceStore`) using:
   - DB-backed `feed_sources` table when Turso is configured, or
   - in-memory list seeded from `data/sources.json`.
2. `fetchAllFeeds()` fetches enabled feeds with bounded concurrency.
3. `parseFeed()` handles Atom and RSS formats and extracts normalized coffee entries.
4. Results are filtered to recent entries (last ~30 days), sorted by date, and returned.
5. Public UI fetches `/api/coffees` and renders the table.

### Storage modes

- **With Turso (`TURSO_DATABASE_URL` set):**
  - Stores coffees, feed health, feed results, and source list in DB.
  - Supports cron refresh and persistent health/status.
- **Without Turso:**
  - Fetches feeds directly on demand.
  - Keeps short-lived response cache and in-memory source/health state.

---

## Key routes

### Public

- `GET /` — Main CoffeeRadar page.
- `GET /api/coffees` — Returns cached/persisted coffee entries + health metadata.
  - Query `?refresh=true` forces a feed refresh.
- `GET /api/sources` — Returns source list and current health map.

### Owner/Admin (protected)

- `GET /owner/feeds` — Owner feed management UI.
- `GET /api/admin/sources` — Source list + health.
- `POST /api/admin/sources` — Source actions:
  - `add_from_store` (auto-discover feed URL from store URL)
  - `add`
  - `toggle`
  - `remove`
- `GET /api/admin/sources/csv` — Export source list CSV.

### Scheduled refresh

- `GET /api/cron` — Runs feed refresh, writes DB records, and cleans old data.
  - Intended to be called by Vercel cron.
  - Validates bearer token if `CRON_SECRET` is set.

---

## Environment variables

Create a `.env.local` file:

```bash
# Optional: Enable Turso persistence
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Protect owner/admin routes (required for owner area)
OWNER_USERNAME=
OWNER_PASSWORD=

# Optional: protect /api/cron with bearer auth
CRON_SECRET=
```

### Behavior notes

- If `OWNER_USERNAME` / `OWNER_PASSWORD` are missing, owner/admin routes return `503`.
- If Turso is not configured, app still works in local mode with in-memory fallback.

---

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

---

## Build and run

```bash
npm run build
npm run start
```

---

## Feed management notes

- Initial source seeds come from `data/sources.json`.
- In Turso mode, seeds are inserted into `feed_sources` only when empty (first init).
- Owner UI supports quick add by store URL via feed auto-discovery.
- Feed discovery tries HTML autodiscovery links first, then common feed paths.

---

## Data retention

The app keeps recent data and prunes stale records:

- Coffee entries older than 30 days are cleaned.
- Feed result status rows older than 30 days are cleaned.

This cleanup is run during cron refresh and manual refresh flows.

---

## Repository map

- `src/app/page.tsx` — Home page.
- `src/components/CoffeeTable.tsx` — Main data table UI and client-side filtering/sorting.
- `src/app/owner/feeds/page.tsx` — Owner feed admin UI.
- `src/app/api/coffees/route.ts` — Public coffee API.
- `src/app/api/cron/route.ts` — Scheduled refresh endpoint.
- `src/app/api/sources/route.ts` — Public sources + health endpoint.
- `src/app/api/admin/sources/*` — Owner source management APIs.
- `src/lib/feedFetcher.ts` — Concurrent feed fetch orchestration.
- `src/lib/feedParser.ts` — Atom/RSS parsing and normalization.
- `src/lib/feedDiscovery.ts` — Store URL → feed URL discovery.
- `src/lib/db.ts` — Turso schema and persistence helpers.
- `src/lib/sourceStore.ts` — Unified source storage abstraction.
- `data/sources.json` — Seed source list.
- `vercel.json` — Cron schedule config.

---

## Deployment notes

- Project is configured for Vercel cron at `0 6 * * *` (UTC) hitting `/api/cron`.
- Ensure environment variables are set in deployment environment.
- If using Turso, verify DB URL/token and connectivity before enabling cron.

---

## Current limitations / future improvements

- No formal test suite is currently defined in `package.json`.
- Feed parsing quality can vary across non-standard source formats.
- Additional source-specific adapters and quality metrics are planned (see `docs/feed-data-quality-plan.md`).
