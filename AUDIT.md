# Codebase Audit — CLAUDE.md Coding Rule Violations

**Date:** 2026-04-12
**Scope:** Full codebase review against CLAUDE.md coding rules
**Status:** Immutable reference — do not modify after creation

---

## Top 5 Violations Ranked by Severity

### 1. OwnerFeedsPage is a 547-line function (max 50)

**File:** `src/app/owner/feeds/page.tsx:22-568`
**Rule violated:** "Max 50 lines per function."

The entire admin page is a single React component function — 547 lines containing 15+ state variables, 10+ async handler functions, and ~300 lines of JSX. This is 11x the limit. Any change to this file risks regressions across unrelated features (feed management, user management, CSV import, cron trigger, suggestion triage) because they all share one scope. This is the single largest structural liability in the codebase.

---

### 2. Swallowed errors in the main coffee API route

**File:** `src/app/api/coffees/route.ts:76-81, 107-112`
**Rule violated:** "Fail fast and loud. No empty catch blocks. No swallowed errors."

Both the Turso and non-Turso code paths catch all exceptions and silently return fallback data with zero logging. If the database is misconfigured, feeds are broken, or a network partition occurs, the only signal is that fallback data appears — no log entry, no error, no way to diagnose the issue.

The `useCoffeeData` hook (`src/hooks/useCoffeeData.ts:21-22`) compounds this: its catch block is completely empty (`// keep existing data`), so even a 500 response with useful error info is discarded silently. Errors from the most critical data pipeline vanish without a trace.

---

### 3. Shared mutable state in `sources.ts` — exported across modules

**File:** `src/lib/sources.ts:4, 38`
**Rule violated:** "No shared mutable state between modules. Data flows through arguments and return values."

Two module-level mutable variables (`sources` at line 4 and `inMemoryHealth` at line 38) are exposed via exported getter/setter functions and mutated by 6 different exported functions (`getSources`, `addSource`, `updateSource`, `removeSource`, `toggleSource`, `setInMemoryHealth`). Multiple modules import and mutate this state: `sourceStore.ts` delegates to it, `coffees/route.ts` calls `setInMemoryHealth()`, and `admin/sources/route.ts` reads via `getInMemoryHealth()`. In the serverless Next.js runtime, concurrent requests can interleave reads and writes to these variables without synchronization, creating potential for stale or inconsistent state.

The `localCache` in `src/app/api/coffees/route.ts:88` has the same pattern — a module-level mutable cache written by any request and read by subsequent ones.

---

### 4. Unvalidated inputs in admin API actions

**File:** `src/app/api/admin/sources/route.ts:137-143`
**Rule violated:** "Treat all external inputs as untrusted: validate types, shapes, and bounds at module boundaries."

The `"remove"` action (line 138) and `"toggle"` action (line 142) pass `body.url` directly to `removeMasterSource()` and `toggleMasterSource()` with no validation at all — not even a truthiness check. If `body.url` is `undefined`, an object, or an empty string, the downstream functions will operate on garbage input.

Additional unvalidated inputs:
- `"add"` action (line 130): validates `name` and `url` presence but not `website` type or format.
- `"approve_suggestion"` action (line 99): validates presence of `oldUrl`/`newUrl`/`name` but not their types (could be numbers, arrays, etc.).
- Login endpoint (`src/app/api/auth/login/route.ts:8-12`): checks truthiness of `username`/`password` but not that they are strings.

---

### 5. Two functions over 50 lines in feedTriage.ts

**File:** `src/lib/feedTriage.ts:131-200` and `src/lib/feedTriage.ts:406-487`
**Rule violated:** "Max 50 lines per function" and "Functions do one thing."

`checkSiteAlive` (70 lines, lines 131-200) handles network errors, 7 different HTTP status ranges, redirect detection, domain comparison, and HTML extraction — all in one function.

`triageFailedFeed` (82 lines, lines 406-487) orchestrates URL normalization, site liveness check, product page crawling, feed URL construction, and candidate probing in a single function body.

Both functions handle multiple distinct responsibilities that could be extracted.

---

## Notable Mentions (Outside Top 5)

| Location | Rule | Description |
|----------|------|-------------|
| `src/app/owner/feeds/page.tsx:90` | No fire-and-forget promises | `fetchSources()` called without `await` after cron completes. No catch, no comment. |
| `src/lib/feedFetcher.ts:31-33` | Fail fast and loud | `fetchOne` catch block returns safe default but never logs — feed failures invisible during debugging. |
| `src/lib/feedFetcher.ts:36-89` | Functions do one thing | `fetchAllFeeds` fetches, deduplicates, and sorts in one 53-line function. |
| `src/hooks/useCoffeeData.ts:21-22` | No swallowed errors | Completely empty catch block with only a comment `// keep existing data`. |
| `src/lib/siteAuth.ts:44-46` | Fail fast and loud | Write failure to `local-auth.json` is logged but silently swallowed — callers believe save succeeded. |
