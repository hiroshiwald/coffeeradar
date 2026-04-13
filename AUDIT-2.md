# Codebase Audit 2 — CLAUDE.md Coding Rule Violations

**Date:** 2026-04-13
**Scope:** Fresh full-codebase scan after all 5 AUDIT.md fixes were applied
**Status:** Immutable reference — do not modify after creation

---

## Prior Audit Fix Verification

All 5 violations from AUDIT.md (2026-04-12) are confirmed resolved:

| # | Original Violation | Status |
|---|-------------------|--------|
| 1 | OwnerFeedsPage 547-line monolith | **Fixed** — now 48-line orchestrator + 15 extracted modules |
| 2 | Swallowed errors in coffee API route | **Fixed** — all catch blocks log via `logger.error`/`logger.warn` |
| 3 | Shared mutable state in sources.ts | **Fixed** — factory pattern with closure; singleton private to sourceStore |
| 4 | Unvalidated inputs in admin API | **Fixed** — `typeof` checks, `isNonEmptyString()`, `isValidUrl()` on all inputs |
| 5 | Two 50+ line functions in feedTriage.ts | **Fixed** — `checkSiteAlive` 23 lines, `triageFailedFeed` 34 lines; helpers extracted |

---

## Top 5 Violations Ranked by Severity

### 1. POST handler is a 133-line function with 7 action branches

**File:** `src/app/api/admin/sources/route.ts:36-168`
**Rule violated:** "Max 50 lines per function."

The `POST()` handler dispatches seven distinct actions (`add_from_store`, `rescan_failed`, `delete_dead_source`, `approve_suggestion`, `dismiss_suggestion`, `add`, `remove`, `toggle`) in a single 133-line function body. Each action has its own validation, business logic, and response shape. A change to one action risks collateral damage to all others. This is 2.6× the limit.

**Pre-existing** — not in AUDIT.md scope.

---

### 2. initDb is an 83-line monolith combining schema DDL and seed insertion

**File:** `src/lib/db.ts:19-101`
**Rule violated:** "Max 50 lines per function." and "Functions do one thing."

`initDb()` creates 6 tables, 5 indexes, then conditionally seeds feed sources from JSON — two distinct responsibilities in one function. At 83 lines it is 1.7× the limit.

**Pre-existing** — not in AUDIT.md scope.

---

### 3. GET handler is a 73-line function interleaving two code paths

**File:** `src/app/api/coffees/route.ts:13-85`
**Rule violated:** "Max 50 lines per function."

The `GET()` handler branches on Turso availability (line 22), then within the Turso path branches again on `forceRefresh` (line 31). The two code paths share only auth checking and the function signature. At 73 lines it is 1.5× the limit.

**Pre-existing** — not in AUDIT.md scope.

---

### 4. crawlKeywordAnchors is 58 lines

**File:** `src/lib/feedTriage.ts:195-252`
**Rule violated:** "Max 50 lines per function."

Regex-based anchor extraction with URL resolution, domain filtering, and deduplication. Single responsibility but exceeds the limit by 8 lines.

**Pre-existing** — not in AUDIT.md scope.

---

### 5. probeForWorkingFeed is 55 lines — introduced during Fix #5

**File:** `src/lib/feedTriage.ts:395-449`
**Rule violated:** "Max 50 lines per function."

Extracted from `triageFailedFeed` during Fix #5 to bring that function under 50 lines. The helper itself exceeds the limit by 5 lines. Builds candidate URLs, probes each, and constructs either a `recommend_add` or `manual_review` result.

**Introduced** during AUDIT.md Fix #5 (2026-04-13).

---

## Notable Mentions

| Location | Rule | Description | Origin |
|----------|------|-------------|--------|
| `src/lib/feedFetcher.ts:36-89` | ≤50 lines | `fetchAllFeeds()` = 54 lines — fetches, deduplicates, sorts | Pre-existing |
| `src/lib/feedFetcher.ts:31-33` | Fail fast | `fetchOne()` catch returns safe default with no logging | Pre-existing |
| `src/lib/authGuard.ts:27-29, 42-44` | Fail fast | Both catch blocks return DENIED without logging the error | Pre-existing |
| `src/components/owner-feeds/useOwnerCron.ts:45` | Async discipline | Fire-and-forget `fetchSources()` — not awaited, no catch, no comment | Introduced (Fix #1) |
| `src/lib/siteAuth.ts:44-46` | Fail fast | `saveAuthData()` logs warn but callers believe save succeeded | Pre-existing |
| `src/components/owner-feeds/SiteAccessControl.tsx:12-64` | ≤50 lines | 53 lines — borderline; exception clause may apply (tightly coupled form + user list) | Introduced (Fix #1) |
