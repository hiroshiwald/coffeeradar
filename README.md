# CoffeeRadar

CoffeeRadar is a Next.js app that aggregates recent coffee releases from specialty roasters by fetching and parsing RSS/Atom feeds, then displaying the results in a searchable, filterable UI.

## What it does

- Aggregates feed entries from a master source list of roasters.
- Parses and normalizes release data (coffee name, process, notes, price, image, link, date).
- Shows data in a responsive table with search, sorting, and filtering.
- Supports a protected owner admin area for managing feed sources and site users.
- Supports site-wide password protection with cookie-based sessions.
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
- **Testing:** Vitest

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
  - Stores coffees, feed health, feed results, source list, and site users in DB.
  - Supports cron refresh and persistent health/status.
- **Without Turso:**
  - Fetches feeds directly on demand.
  - Keeps short-lived response cache and in-memory source/health state.
  - Site users stored in `data/local-auth.json`.

---

## Site protection

### How it works

Site protection is **automatically enabled** when `OWNER_PASSWORD` is set. No separate toggle is needed. When enabled, all public pages and API routes require authentication — visitors are redirected to a login page.

The system uses **defense-in-depth** with three independent auth layers:
1. **Middleware** (`middleware.ts`) — intercepts all requests, redirects unauthenticated visitors to `/login`, returns 401 for API routes. Wrapped in try/catch so exceptions deny access (fail-closed).
2. **Server component guard** (`page.tsx`) — checks auth server-side before rendering the home page. Uses `force-dynamic` to prevent static generation from bypassing auth.
3. **API route guards** (`/api/coffees`, `/api/sources`) — each route independently validates the session cookie before returning data.

Sessions use HMAC-SHA-256 signed cookies (7-day expiry, HttpOnly, SameSite=Lax).

### How to turn it on

Add these environment variables in your hosting dashboard (e.g., Vercel):

| Variable | Value | Required |
|----------|-------|----------|
| `OWNER_USERNAME` | Your chosen username | Yes |
| `OWNER_PASSWORD` | Your chosen password | Yes |
| `SESSION_SECRET` | Random string, 32+ characters | Yes (production) |

Then redeploy. The site will show a login page instead of the coffee data.

### How to turn it off

Either:
- Remove `OWNER_PASSWORD` from your environment variables, or
- Add `SITE_PROTECTION_ENABLED=false` to keep the password for admin panel access while making the public site open

### Owner vs. site users

There are two tiers of authentication:

| | Owner | Site Users |
|--|-------|-----------|
| Created in | Vercel env vars (`OWNER_USERNAME`/`OWNER_PASSWORD`) | Admin panel at `/owner/feeds` |
| Can log in at `/login` | Yes | Yes |
| Can access admin panel (`/owner/feeds`) | Yes (via Basic Auth) | No |
| Can add/remove users | Yes | No |
| Can be deleted | No (env var) | Yes (from admin panel) |

The owner credentials always work as a fallback login. Site users are stored in the database (Turso) or local file (`data/local-auth.json`).

### Managing users

1. Log in at `/login` with your owner credentials.
2. Go to `/owner/feeds` (you'll be prompted for Basic Auth — same credentials).
3. Use the **Site Access Control** section to add or remove users.
4. Each user gets their own username and password and can log in independently.

---

## Key routes

### Public (protected when `OWNER_PASSWORD` is set)

- `GET /` — Main CoffeeRadar page.
- `GET /api/coffees` — Returns cached/persisted coffee entries + health metadata.
  - Query `?refresh=true` forces a feed refresh.
- `GET /api/sources` — Returns source list and current health map.

### Authentication

- `GET /login` — Login page.
- `POST /api/auth/login` — Authenticate with username/password, sets session cookie.
- `POST /api/auth/logout` — Clears session cookie.

### Owner/Admin (Basic Auth protected)

- `GET /owner/feeds` — Owner feed management UI and site user management.
- `GET /api/admin/sources` — Source list + health.
- `POST /api/admin/sources` — Source actions:
  - `add_from_store` (auto-discover feed URL from store URL)
  - `add`
  - `toggle`
  - `remove`
- `GET /api/admin/sources/csv` — Export source list CSV.
- `GET/POST /api/admin/site-auth` — List/add/remove site users.

### Scheduled refresh

- `GET /api/cron` — Runs feed refresh, writes DB records, and cleans old data.
  - Intended to be called by Vercel cron.
  - Validates bearer token if `CRON_SECRET` is set.

---

## Environment variables

Copy `.env.example` to `.env.local` for local development:

```bash
# Site protection (auto-enabled when OWNER_PASSWORD is set)
OWNER_USERNAME=          # Username for login and /owner admin panel
OWNER_PASSWORD=          # Password for login and /owner admin panel
SESSION_SECRET=          # Random string, min 32 chars (required in production)

# Optional
SITE_PROTECTION_ENABLED= # Set to "false" to explicitly disable site protection
CRON_SECRET=             # Protect /api/cron with bearer auth

# Database (optional — app works without Turso in local/dev mode)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

### Behavior notes

- If `OWNER_PASSWORD` is set, site protection is automatically enabled.
- If `OWNER_USERNAME` / `OWNER_PASSWORD` are missing, owner/admin routes return `503`.
- If `SESSION_SECRET` is missing in production, the app throws an error (fail-closed).
- If Turso is not configured, app still works in local mode with in-memory fallback.

---

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

---

## Testing

```bash
npm test          # Run all tests (single run)
npm run test:watch  # Watch mode
```

The project uses **Vitest** with 109 tests across 9 test files:

- `session.test.ts` — Cookie creation, validation, tampering detection, expiry
- `crypto.test.ts` — Password hashing, verification, salt randomness
- `authGuard.test.ts` — Auth guard for server components and API routes, fail-closed behavior
- `feedParser.test.ts` — Atom/RSS feed parsing and normalization
- `feedFetcher.test.ts` — Concurrent feed fetch orchestration
- `coffeeFilters.test.ts` — Client-side filtering logic
- `formatters.test.ts` — Date and text formatting utilities
- `noteColors.test.ts` — Tasting note color mapping
- `heuristics.test.ts` — Coffee type and process heuristics

---

## Build and deploy

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
- Duplicate coffee entries are deduplicated.

This cleanup is run during cron refresh and manual refresh flows.

---

## Repository map

### Pages and components
- `src/app/page.tsx` — Home page (server component with auth guard).
- `src/app/login/page.tsx` — Login page.
- `src/app/owner/feeds/page.tsx` — Owner feed admin UI and site user management.
- `src/components/CoffeeTable.tsx` — Main data table UI and client-side filtering/sorting.
- `src/components/ThemeToggle.tsx` — Dark/light mode toggle.

### API routes
- `src/app/api/coffees/route.ts` — Public coffee API (with auth guard).
- `src/app/api/sources/route.ts` — Public sources + health endpoint (with auth guard).
- `src/app/api/auth/login/route.ts` — Login endpoint.
- `src/app/api/auth/logout/route.ts` — Logout endpoint.
- `src/app/api/admin/sources/*` — Owner source management APIs.
- `src/app/api/admin/site-auth/route.ts` — Site user management API.
- `src/app/api/cron/route.ts` — Scheduled refresh endpoint.

### Auth and security
- `middleware.ts` — Auth middleware with fail-closed error handling.
- `src/lib/authGuard.ts` — Shared auth guard for server components and API routes.
- `src/lib/session.ts` — HMAC-SHA-256 cookie session management.
- `src/lib/crypto.ts` — Password hashing (SHA-256 + salt) with constant-time comparison.
- `src/lib/siteAuthStore.ts` — Site user management abstraction (DB or file-based).
- `src/lib/siteAuth.ts` — File-based user store fallback (`data/local-auth.json`).

### Feed pipeline
- `src/lib/feedFetcher.ts` — Concurrent feed fetch orchestration.
- `src/lib/feedParser.ts` — Atom/RSS parsing and normalization.
- `src/lib/feedDiscovery.ts` — Store URL to feed URL discovery.
- `src/lib/heuristics.ts` — Coffee type and process detection heuristics.

### Data and storage
- `src/lib/db.ts` — Turso schema and persistence helpers.
- `src/lib/sourceStore.ts` — Unified source storage abstraction.
- `src/lib/sources.ts` — In-memory source/health state.
- `src/lib/fallback.ts` — Fallback coffee data when feeds are unavailable.
- `data/sources.json` — Seed source list.

### Utilities
- `src/lib/types.ts` — Shared TypeScript types.
- `src/lib/formatters.ts` — Date and text formatting.
- `src/lib/noteColors.ts` — Tasting note color mapping.
- `src/lib/coffeeFilters.ts` — Client-side filtering logic.
- `src/lib/constants.ts` — App constants.
- `src/hooks/useCoffeeData.ts` — Client data fetching hook (with 401 redirect).

### Configuration
- `vitest.config.ts` — Test configuration.
- `next.config.mjs` — Next.js configuration.
- `vercel.json` — Cron schedule config.
- `.env.example` — Documented environment variables.

---

## Deployment notes

- Project is configured for Vercel cron at `0 6 * * *` (UTC) hitting `/api/cron`.
- Ensure environment variables are set in deployment environment (see [Environment variables](#environment-variables)).
- If using Turso, verify DB URL/token and connectivity before enabling cron.
- Site protection activates automatically when `OWNER_PASSWORD` is set — no extra toggle needed.

---

## Current limitations / future improvements

- Feed parsing quality can vary across non-standard source formats.
- Additional source-specific adapters and quality metrics are planned (see `docs/feed-data-quality-plan.md`).
