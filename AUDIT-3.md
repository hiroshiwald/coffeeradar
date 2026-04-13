# Codebase Audit 3 — CLAUDE.md Coding Rule Violations

**Date:** 2026-04-13
**Scope:** Fresh full-codebase scan after all 5 AUDIT-2.md fixes were applied
**Status:** Immutable reference — do not modify after creation

---

## Prior Audit Fix Verification

All 5 violations from AUDIT-2.md (2026-04-13) are confirmed resolved:

| # | Original Violation | Status |
|---|-------------------|--------|
| 1 | POST handler 133-line monolith in admin/sources/route.ts | **Fixed** — 21-line dispatcher + 8 module-private handlers (7–26 lines each) |
| 2 | initDb 83-line monolith in db.ts | **Fixed** — 6-line orchestrator + `SCHEMA_DDL` const, `createSchema` (3 lines), `seedFeedSources` (18 lines) |
| 3 | GET handler 73-line monolith in coffees/route.ts | **Fixed** — 14-line dispatcher + `handleWithDb` (44 lines) + `handleWithoutDb` (23 lines) |
| 4 | crawlKeywordAnchors 58 lines in feedTriage.ts | **Fixed** — 45 lines after extracting `anchorTextBlob` helper |
| 5 | probeForWorkingFeed 55 lines in feedTriage.ts | **Fixed** — 43 lines after extracting `buildAliveDiagnostics` helper |

---

## Top 5 Violations Ranked by Severity

### 1. Uncaught `request.json()` in 3 API routes

**Files:**
- `src/app/api/auth/login/route.ts:8`
- `src/app/api/admin/site-auth/route.ts:15`
- `src/app/api/admin/sources/route.ts:155`

**Rule violated:** "Treat all external inputs as untrusted: validate types, shapes, and bounds at module boundaries before processing."

All three POST handlers call `await request.json()` as their first statement with no try/catch. If a client sends malformed JSON (truncated body, wrong content-type, empty body), the call throws a `SyntaxError` that propagates as an unstructured 500 response. The input validation added in AUDIT.md Fix #4 runs *after* the parse — it cannot help if parsing itself fails.

**Pre-existing** — not caught by prior audits.

---

### 2. `fetchAllFeeds()` is 54 lines and does three things

**File:** `src/lib/feedFetcher.ts:36-89`
**Rule violated:** "Max 50 lines per function." and "Functions do one thing."

The function batches concurrent fetches (lines 49–64), deduplicates by entry ID keeping the newest date (lines 66–78), and sorts by date descending (lines 82–86). These are three distinct responsibilities in one 54-line body — 4 lines over the limit.

**Pre-existing** — noted in AUDIT.md and AUDIT-2.md Notable Mentions but never promoted to top 5 for fixing.

---

### 3. `middleware()` function is 59 lines

**File:** `middleware.ts:37-95`
**Rule violated:** "Max 50 lines per function."

The middleware handles 5 route-class branches (owner/admin, login, auth API, cron, public) and a 10-line catch block that duplicates the redirect-vs-401 logic for fail-closed safety. The CLAUDE.md exception clause ("if splitting would scatter tightly related state or logic… note why in a comment and keep it together") may apply — middleware does route-based auth as a single concern, and the catch block duplication is intentional for defense-in-depth. However, no comment documents the exception.

**Pre-existing** — not previously flagged.

---

### 4. `fetchOne()` catch block has no logging

**File:** `src/lib/feedFetcher.ts:31-33`
**Rule violated:** "Fail fast and loud. No empty catch blocks. No swallowed errors."

The catch block returns `{ entries: [], ok: false }` with no logging. When a feed fetch fails due to network error, timeout, or DNS failure, the error is silently discarded. During debugging, there is no way to distinguish DNS failure from timeout from TLS error — the only signal is the feed appearing as "error" in health status.

**Pre-existing** — noted in AUDIT.md and AUDIT-2.md Notable Mentions but never promoted to top 5 for fixing.

---

### 5. Async hooks lack error handling — unhandled promise rejections

**Files:**
- `src/components/owner-feeds/useOwnerAuth.ts:10-15` — `fetchSiteAuth()` has no try/catch; network errors or non-JSON responses throw unhandled
- `src/components/owner-feeds/useOwnerSources.ts:10-18` — `fetchSources()` has no try/catch; same issue
- `src/components/owner-feeds/useOwnerCron.ts:45` — `fetchSources()` called without `await` or `.catch()`; fire-and-forget with no detach comment

**Rules violated:** "Fail fast and loud" and "Async discipline: no fire-and-forget promises."

If `/api/admin/sources` or `/api/admin/site-auth` returns a network error, non-2xx status, or non-JSON body, the unhandled rejection will crash the component tree. The fire-and-forget in `useOwnerCron.ts:45` means a fetch failure after cron completes is silently lost.

**Introduced** during AUDIT.md Fix #1 (2026-04-13) — the owner page decomposition.

---

## Notable Mentions

| Location | Rule | Description | Origin |
|----------|------|-------------|--------|
| `src/lib/authGuard.ts:27-29, 42-44` | Fail fast | Both catch blocks return DENIED without logging the error | Pre-existing |
| `src/lib/siteAuth.ts:44-46` | Fail fast | `saveAuthData()` logs warn but callers believe save succeeded | Pre-existing |
| `src/components/owner-feeds/SiteAccessControl.tsx:12-64` | ≤50 lines | 53 lines — borderline; exception clause may apply (tightly coupled form + user list) but no comment | Introduced (Fix #1) |
