## Modules

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/lib/types.ts` | Shared TypeScript interfaces for the entire app | `FeedSource`, `CoffeeEntry`, `SiteUser`, `ApiResponse` |
| `src/lib/constants.ts` | Global configuration constants | `FEED_CONCURRENCY` (25), `FEED_TIMEOUT_MS` (5000) |
| `src/lib/db.ts` | Turso (libSQL) persistence layer — schema, queries, migrations | `hasTurso()`, `initDb()`, `getCoffees()`, `getFeedHealth()`, `getFeedSources()`, `upsertCoffees()`, `saveFeedHealth()`, `saveFeedResults()`, `cleanOldData()`, `upsertFeedSource()`, `removeFeedSource()`, `toggleFeedSource()`, `upsertFeedSuggestion()`, `listFeedSuggestions()`, `deleteFeedSuggestion()`, `dbGetSiteUsers()`, `dbGetSiteUserByUsername()`, `dbAddSiteUser()`, `dbRemoveSiteUser()`, `chunkedBatchInsert()` |
| `src/lib/sources.ts` | In-memory store factory for dev without Turso — closure-based, no module-level mutable state | `createInMemoryStore()`, `InMemoryStore` |
| `src/lib/sourceStore.ts` | Storage abstraction — delegates to DB or in-memory; owns private singleton store | `listMasterSources()`, `listEnabledMasterSources()`, `addOrUpdateMasterSource()`, `removeMasterSource()`, `toggleMasterSource()`, `getSourceHealth()`, `setSourceHealth()` |
| `src/lib/feedFilters.ts` | Pure helpers for feed health classification and source filtering | `getHealthStatus()`, `computeHealthCounts()`, `filterSources()` |
| `src/lib/siteAuth.ts` | File-based user store fallback (reads/writes `data/local-auth.json`) | `memGetSiteUsers()`, `memGetSiteUserByUsername()`, `memAddSiteUser()`, `memRemoveSiteUser()` |
| `src/lib/siteAuthStore.ts` | Auth storage abstraction — delegates to DB or file-based store | `hasPersistentSiteAuthStore()`, `listSiteUsers()`, `addSiteUser()`, `removeSiteUser()`, `validateSiteUser()` |
| `src/lib/authGuard.ts` | Auth validation for server components and API routes | `checkSiteAuth()`, `checkSiteAuthFromRequest()` |
| `src/lib/session.ts` | HMAC-SHA-256 cookie session management (7-day expiry) | `createSessionCookie()`, `validateSessionCookie()`, `clearSessionCookie()`, `getSessionCookieName()` |
| `src/lib/crypto.ts` | Password hashing with SHA-256 and random salt | `hashPassword()`, `verifyPassword()` |
| `src/lib/feedFetcher.ts` | Concurrent feed orchestration with batching and deduplication | `fetchAllFeeds()` |
| `src/lib/feedParser.ts` | Atom/RSS parsing and normalization into `CoffeeEntry` | `parseFeed()`, `parseAtomFeed()`, `parseRssFeed()` |
| `src/lib/feedParserHelpers.ts` | Pure extraction helpers for XML text, images, prices | `deepText()`, `extractImage()`, `extractProductType()`, `extractShopifyPrice()`, `extractShopifyTags()` |
| `src/lib/heuristics.ts` | Coffee metadata detection — type, process, tasting notes, price, merch | `detectType()`, `detectProcess()`, `extractNotes()`, `extractPrice()`, `isMerchandise()` |
| `src/lib/heuristicsData.ts` | Static vocabularies — origins, processes, note words, merch keywords | `ORIGINS`, `PROCESS_MAP`, `NOTE_PATTERNS`, `NOTE_WORDS`, `TEXTURE_NOTE_WORDS`, `MERCH_KEYWORDS`, `MERCH_PRODUCT_TYPES` |
| `src/lib/feedDiscovery.ts` | Discovers feed URLs from store URLs via autodiscovery and common paths | `discoverFeedFromStoreUrl()` |
| `src/lib/feedTriage.ts` | Two-step triage for failed feeds — reachability check then feed probing | `triageFailedFeed()`, `triageFailedFeeds()` |
| `src/lib/feedValidator.ts` | Validates feed URL returns parseable XML with entries | `isValidFeedUrl()` |
| `src/lib/coffeeFilters.ts` | Client-side filtering and sorting logic | `filterCoffees()`, `sortCoffees()`, `countNotes()` |
| `src/lib/noteColors.ts` | Maps tasting note names to Tailwind color classes | `getNoteColor()` |
| `src/lib/formatters.ts` | Date and text formatting utilities | `timeAgo()` |
| `src/lib/logger.ts` | Console wrapper, silent under test | `logger` |
| `src/lib/fallback.ts` | Demo data when feeds are unavailable | `FALLBACK_COFFEES` |
| `src/app/page.tsx` | Home page — renders coffee table with auth guard | Server component |
| `src/app/login/page.tsx` | Login page | Server component |
| `src/app/owner/feeds/page.tsx` | Admin panel orchestrator — delegates to extracted hooks and components | Client component |
| `src/app/layout.tsx` | Root layout | Server component |
| `src/app/api/coffees/route.ts` | Public API — serves cached coffees, optional manual refresh | `GET` handler |
| `src/app/api/cron/route.ts` | Cron endpoint — fetches all feeds, persists, cleans old data | `GET` handler (bearer token auth) |
| `src/app/api/auth/login/route.ts` | Login endpoint — validates credentials, sets session cookie | `POST` handler |
| `src/app/api/auth/logout/route.ts` | Logout endpoint — clears session cookie | `POST` handler |
| `src/app/api/admin/sources/route.ts` | Admin source management — CRUD, discovery, triage, suggestions | `GET`, `POST` handlers |
| `src/app/api/admin/sources/csv/route.ts` | Exports source list as CSV | `GET` handler |
| `src/app/api/admin/site-auth/route.ts` | Admin user management — list, add, remove site users | `GET`, `POST` handlers |
| `src/components/CoffeeTable.tsx` | Main UI orchestrator — data fetching, filtering, rendering | Client component |
| `src/components/coffee-table/CoffeeTableFilters.tsx` | Search, type/process/note filters, merch toggle, refresh | Client component |
| `src/components/coffee-table/CoffeeTableHeader.tsx` | Sortable table column headers | Client component |
| `src/components/coffee-table/CoffeeTableRow.tsx` | Single coffee entry row with note color-coding | Client component |
| `src/components/coffee-table/useCoffeeFilters.ts` | Filter and sort state management hook | `useCoffeeFilters()` |
| `src/components/owner-feeds/AddFeedForm.tsx` | Manual feed URL entry form | Client component |
| `src/components/owner-feeds/FeedFilterBar.tsx` | Health-status filter tabs and rescan button | Client component |
| `src/components/owner-feeds/FeedSourceItem.tsx` | Single feed source row with toggle/remove controls | Client component |
| `src/components/owner-feeds/FeedSuggestionCard.tsx` | Dispatches to the correct suggestion card variant | Client component |
| `src/components/owner-feeds/OwnerPageHeader.tsx` | Admin page title bar with counts and cron/export buttons | Client component |
| `src/components/owner-feeds/QuickAddForm.tsx` | Store URL entry with auto-discovery | Client component |
| `src/components/owner-feeds/SiteAccessControl.tsx` | User management form and user list | Client component |
| `src/components/owner-feeds/SourceList.tsx` | Renders filtered feed source list with suggestion cards | Client component |
| `src/components/owner-feeds/SuggestionCards.tsx` | Recommendation/deletion/manual-review card variants | Client component |
| `src/components/owner-feeds/useOwnerActions.ts` | Admin action dispatcher hook (add, remove, toggle, etc.) | `useOwnerActions()` |
| `src/components/owner-feeds/useOwnerAuth.ts` | Site auth state and user management hook | `useOwnerAuth()` |
| `src/components/owner-feeds/useOwnerCron.ts` | Cron trigger and failed-feed rescan hook | `useOwnerCron()` |
| `src/components/owner-feeds/useOwnerFilters.ts` | Source search and health-filter state hook | `useOwnerFilters()` |
| `src/components/owner-feeds/useOwnerSources.ts` | Source list fetching and suggestion state hook | `useOwnerSources()` |
| `src/components/ThemeToggle.tsx` | Dark/light mode toggle | Client component |
| `src/hooks/useCoffeeData.ts` | Data fetching hook for `/api/coffees` | `useCoffeeData()` |
| `middleware.ts` | Route protection — redirects unauthenticated users, 401 for API | Next.js middleware |
| `data/sources.json` | Seed list of curated coffee roaster feed URLs | JSON data |

## Invariants

**Authentication**
- Site protection is enabled when `OWNER_PASSWORD` env var is set (unless `SITE_PROTECTION_ENABLED=false`)
- Three auth layers enforce defense-in-depth: middleware, server component guards, API route guards
- Owner credentials (env vars) always work as fallback and cannot be revoked via UI
- Sessions expire after 7 days; cookies use HMAC-SHA-256 signatures with constant-time comparison
- Middleware is fail-closed — all exceptions deny access

**Database**
- `feed_sources.url` is the primary key (unique)
- `coffees.id` is a stable SHA1 hash of (roaster, link, publishedAt, title) — ensures deduplication across runs
- `feed_health` is a singleton row (id=1), upserted each refresh
- `feed_results` is replaced wholesale each cron run (one row per source)
- `site_users.username` is the primary key (unique)
- Data retention window is 30 days — older coffees and results are pruned by `cleanOldData()`
- Batch inserts are chunked to 50 items to avoid SQL payload limits

**Feed Processing**
- Max 25 concurrent feed fetches; each has a 5-second timeout
- Same coffee from multiple sources keeps the newest date
- Empty entry arrays mark a feed as errored
- Feeds must be valid XML with at least one entry/item to pass validation

**Data Flow**
- Public API reads cached data; `?refresh=true` triggers a write-then-read cycle
- Cron endpoint (`/api/cron`) is the authoritative refresh path, protected by bearer token (`CRON_SECRET`)
- Sources are soft-deleted via toggle; admin must explicitly remove

## Boundaries

**API Routes → Library**
- `/api/coffees` → `authGuard`, `db` (getCoffees, getFeedHealth), `feedFetcher` (on manual refresh), `fallback`
- `/api/cron` → `db` (initDb, upsertCoffees, saveFeedHealth, saveFeedResults, cleanOldData), `feedFetcher`
- `/api/auth/login` → `siteAuthStore` (validateSiteUser), `session` (createSessionCookie)
- `/api/auth/logout` → `session` (clearSessionCookie)
- `/api/admin/sources` → `sourceStore`, `db` (getFeedResults), `feedDiscovery`, `feedTriage`, `feedSuggestion`
- `/api/admin/site-auth` → `siteAuthStore`, `crypto`

**Storage Abstraction**
- `sourceStore` → `db` (if Turso available) or `sources` (in-memory fallback)
- `siteAuthStore` → `db` (if Turso available) or `siteAuth` (file-based fallback)

**Frontend → Backend**
- `useCoffeeData` hook → `GET /api/coffees`
- `CoffeeTable` → `useCoffeeData`, `useCoffeeFilters`, `coffeeFilters`
- Admin page → `GET/POST /api/admin/sources`, `GET/POST /api/admin/site-auth`
- Login page → `POST /api/auth/login`

**External Services**
- `feedFetcher` / `feedParser` → external RSS/Atom feed URLs (outbound HTTP)
- `feedDiscovery` / `feedTriage` → external store URLs (outbound HTTP)
- `db` → Turso cloud database (libSQL over HTTP)
- Vercel cron → `GET /api/cron` (scheduled daily at 06:00 UTC)

**Middleware**
- `middleware.ts` intercepts all routes except `/login`, `/api/auth/*`, and static assets
- Delegates to `session.validateSessionCookie()` and `siteAuthStore`
