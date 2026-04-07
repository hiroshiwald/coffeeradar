# CoffeeRadar Test Plan

This document describes how CoffeeRadar is tested today, what the new
refactor added, and the manual smoke checklist used before deploys.

## 1. Scope and goals

- Validate that the feed pipeline (fetch → parse → normalize → store) is
  resilient to malformed input.
- Validate auth (sessions, hashing, guards) since it is the highest-risk
  surface.
- Validate the small set of pure utilities the UI relies on
  (`coffeeFilters`, `noteColors`, `formatters`).
- Provide a manual checklist for the parts that aren't worth automating yet
  (UI, e2e flows).

## 2. Test pyramid

| Level | Framework | Where |
|-------|-----------|-------|
| Unit | Vitest (node) | `src/lib/__tests__/*.test.ts` |
| API route | Vitest with mocked DB | (planned — see §9) |
| Component | Vitest + RTL + jsdom | (planned — see §9) |
| Manual smoke / e2e | Manual checklist | §8 |

## 3. Environments

- **Local**: in-memory fallback (no Turso). Site protection off unless
  `OWNER_PASSWORD` is set.
- **CI**: same as local. No network calls — feed fetching is mocked or
  exercised through fixtures.
- **Staging / production**: Turso-backed, real cron, real feeds.

## 4. Module coverage matrix

| Module | Unit | Notes |
|--------|------|-------|
| `lib/session.ts` | ✅ | Cookie creation, signing, tampering, expiry |
| `lib/crypto.ts` | ✅ | Hash + verify, salt randomness |
| `lib/authGuard.ts` | ✅ | Server component + API route guards |
| `lib/feedParser.ts` | ✅ | Atom + RSS parsing |
| `lib/feedParserHelpers.ts` | ✅ NEW | `decodeHtml`, `deepString`, `deepText`, `extractImage*`, `extractShopifyPrice`, `extractShopifyTags`, `extractProductType` |
| `lib/feedFetcher.ts` | ✅ | Concurrent fetch + dedupe |
| `lib/heuristics.ts` | ✅ | Type / process / notes / price |
| `lib/heuristicsHelpers` | ✅ NEW | `tokenizeNotesSegment`, `filterNoiseTokens`, `normalizeNoteCase` |
| `lib/db.ts` | ✅ NEW | `chunkedBatchInsert` (no-op, single, multi, exact, error) |
| `lib/sourceStore.ts` | ✅ NEW | `initDb` memoization |
| `lib/siteAuth.ts` | ✅ NEW | `isAuthData` type guard |
| `lib/feedDiscovery.ts` | partial | Logger now wired; expand fixture coverage later |
| `lib/coffeeFilters.ts` | ✅ | Search, filter, sort |
| `lib/formatters.ts` | ✅ | Date / time-ago |
| `lib/noteColors.ts` | ✅ | Note → class mapping |
| `components/CoffeeTable*` | ⏳ | Component tests pending (needs jsdom + RTL) |
| `app/api/coffees/route.ts` | ⏳ | API route test pending |

## 5. Refactor-specific assertions

The 2026-04-07 refactor must not change observable behavior. The new
unit tests assert:

- `chunkedBatchInsert` produces the same statements as the inline loops it
  replaced (no-op for empty, exact and ragged chunk splits, error
  propagation).
- `sourceStore` calls `initDb` exactly once across parallel reads, and
  re-initializes after `__resetSourceStoreInitForTests`.
- `siteAuth.isAuthData` correctly narrows untyped JSON before any
  property access — replacing the previous `any` cast.
- `extractImage` falls back through `s:image` → `media:content` →
  `media:thumbnail` → `itunes:image` → HTML scrape, matching the previous
  inline behavior.
- `tokenizeNotesSegment`, `filterNoiseTokens`, and `normalizeNoteCase`
  collectively reproduce the original `extractNotes` parsing.

## 6. Running tests

```bash
npm install
npm test            # single run
npm run test:watch  # watch mode
```

Type-check separately with `npx tsc --noEmit`.

## 7. Coverage targets (aspirational)

- `src/lib/`: ≥ 90% lines, ≥ 85% branches.
- `src/components/`: ≥ 70% lines once jsdom tests are added.
- 100% of new helpers (`feedParserHelpers`, `heuristicsHelpers`, `chunkedBatchInsert`).

## 8. Manual e2e smoke checklist

Run before any production deploy. Against `npm run dev` (or a preview URL):

1. Home page loads and renders > 0 coffee rows (or fallback data with the
   "demo data" badge).
2. Typing "ethiopia" in the search box narrows the list.
3. Origin and Process selects narrow the list independently.
4. Clicking a sortable header (Date, Roaster, Coffee, Type, Process,
   Price) flips sort order; clicking again toggles asc/desc.
5. Pagination/scroll behaves as expected and the "N coffees" counter
   matches the visible rows.
6. Coffee rows render images without broken-image icons (or render the
   placeholder when `imageUrl` is empty).
7. `GET /api/coffees` returns valid JSON with `coffees` and `meta`.
8. `GET /api/coffees?refresh=true` triggers a refresh and returns the
   updated data.
9. With `OWNER_PASSWORD` set: `/login` accepts the owner credentials and
   rejects wrong ones; the session cookie is set HttpOnly.
10. `/owner/feeds` Basic Auth: add a source manually, toggle, remove,
    download CSV, add a site user, remove a site user.
11. With `TURSO_*` unset: app still serves via in-memory fallback and the
    dev cache returns the same response within the 30-min window.
12. `npm run build && npm start` produces a production bundle with the
    same behavior.

Optional: turn the first 5 steps into a Playwright spec
(`e2e/smoke.spec.ts`) once we add the dev dep.

## 9. Known gaps and future work

- **Component tests** for `CoffeeTable*` require adding `jsdom` and
  `@testing-library/react` as dev deps and switching the relevant test
  files to `// @vitest-environment jsdom`.
- **API route tests** for `/api/coffees` should mock `getCoffees` /
  `fetchAllFeeds` and assert cache TTL behavior on the local-dev path.
- **Playwright e2e** for the 12 smoke steps above.
- **Coverage gating** in CI once the above land.
