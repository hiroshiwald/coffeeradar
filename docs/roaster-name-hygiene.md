# Roaster name hygiene — handoff for a future session

**Status:** not built. Design deferred deliberately on 2026-09-11.
**Read this before writing any code for it.** Three of the obvious approaches look correct
until you check the source; all three are ruled out below with the reason.

---

## The problem

`data/sources.json` is nominally the master roaster list. In practice the live site stops
reading it after first run, so corrected names never reach production.

`seedFeedSources()` in `src/lib/db.ts`:

```ts
const existing = await db.execute(`SELECT COUNT(*) as count FROM feed_sources`);
const count = Number(existing.rows[0]?.count ?? 0);
if (count > 0) return;
```

Once `feed_sources` holds a single row, the seeder never runs again. Edit a name in the file
and the database keeps the old one forever.

There is also **no rename control anywhere in `/owner/feeds`**. The only path that can change
a name is `AddFeedForm`, which posts `action: "add"`.

Names matter beyond display: `CoffeeEntry.roaster` is a denormalised copy of
`FeedSource.name`, `buildStableId()` hashes the lowercased roaster name into every coffee id,
and `src/lib/roasterSummary.ts` joins sources to coffees on the normalised name.

## What the owner asked for

- **A separate module.** Not an edit to `initDb`, not a widening of an existing function.
- **Runs on a schedule** (weekly or monthly) **and on demand.**
- **Surfaces suspect names in the admin panel for review**, so the owner accepts or rejects
  each one. The model to follow is the review checklist used for the first batch: every
  candidate shown with its current and proposed name, owner unticks what they want kept.
- **No hardcoded one-time migration.** The mechanism must still work in a year with names
  nobody has thought of yet.

## Decisions already made — do not redo these

33 names were reviewed with the owner and are committed to `data/sources.json`. They are
already correct in the file; the gap is purely getting them to a seeded database.

Six were deliberately **kept as scraped**, because they are real brand stylings rather than
artefacts:

`SEY COFFEE` · `GLITCH COFFEE & ROASTERS` · `ONIBUS COFFEE` · `PERC COFFEE` · `SUMP COFFEE` ·
`goodboybob`

`Seth Taylor: Coffee By Design` → `Seth Taylor` (the feed is on sethtaylor.ca; Coffee By
Design is a separate Maine roaster, so the suffix was a scraped tagline).

These choices live in the file by being written there, so **no exception list is needed**. A
detector that re-flags them is a detector that is too eager.

Two traps a blanket rule would fall into, found the hard way:
- `Macondo Coffee Shop` and `Workshop Coffee` contain "Shop" and are correct.
- `data/sources.json` contains **zero** HTML entities. A decode step is a no-op; the 13 raw
  `&` characters in names are correct.

## Ruled out, with reasons

**1. A terminal script posting `action: "add"` for each rename.**
`handleAdd` → `addOrUpdateMasterSource` → `upsertFeedSource`, whose `ON CONFLICT(url) DO
UPDATE` sets `name`, `website` **and** `enabled`. So it reverts any website corrected in the
admin UI since the script was generated, and re-enables any feed deliberately switched off.
Also embeds a frozen snapshot, which is exactly the "hardcoded one-time exception" the owner
rejected. A script was written and then withdrawn for these reasons; it was never run.

**2. Renaming by hand in `/owner/feeds`.**
`AddFeedForm` posts the same `add` action, and leaving the website box blank defaults it to
the feed URL (`website: (website as string) || url`). Same two traps, once per rename.

**3. Deleting the `count > 0` early return in `seedFeedSources`.**
Looks like the obvious fix. It is not, for two independent reasons:
- The statement underneath is `INSERT OR IGNORE INTO feed_sources ...`, which **no-ops on a
  `url` match**. Nothing would update. The early return is not the only barrier.
- Without the guard, a source the owner deleted in `/owner/feeds` is **re-inserted on the
  next cold start**. Deletions would silently undo themselves.

**4. `INSERT ... ON CONFLICT(url) DO UPDATE SET name = excluded.name`.**
Fixes the no-op but keeps the resurrection problem: it always inserts when the row is absent.

**5. Any statement that writes more than `name`.**
`website` and `enabled` belong to the owner. Whatever is built must be provably unable to
touch them — and that guarantee needs a test, because the natural implementation
(`upsertFeedSource`) violates it.

**What is left:** a plain `UPDATE feed_sources SET name = ? WHERE url = ?`. It updates a row
that exists, does nothing for one that does not, and touches nothing else. A `AND name <> ?`
guard makes a run with nothing to change write nothing.

## Open design questions

- **Where do detection rules live?** Keep them out of `src/lib/heuristicsData.ts`, which is
  vocabulary for coffee metadata and unrelated. A rule set that flags ALL-CAPS, storefront
  fragments (`Shop`, `Tuotteet`, `Online Store`, separator-plus-title patterns), and
  unsplit concatenations is the obvious starting point — but see the two traps above.
- **How is a rejection remembered** so the same name is not proposed every month?
  `feed_suggestions` is the existing precedent for "proposed, then approved or dismissed"
  (`upsertFeedSuggestion`, `listFeedSuggestions`, `deleteFeedSuggestion` in `src/lib/db.ts`,
  and `approve_suggestion` / `dismiss_suggestion` in the admin route). Reuse that shape
  rather than inventing one.
- **What drives the schedule?** `vercel.json` already carries one cron hitting `/api/cron`
  daily. Weekly or monthly hygiene could ride that with a date check, or take its own entry.
- **Does the module ever write, or only propose?** Propose-only is the safer default and
  matches what the owner asked for. Writing should require an explicit accept.
- **Where does the proposal come from** — the file, or rules applied to whatever is live?
  These differ: the file carries decisions already made, rules catch names added later
  through the admin page. A complete module probably needs both.

## Constraints from CLAUDE.md that bit during this session

- **Validate external inputs at module boundaries.** `data/sources.json` is cast
  `as FeedSource[]` with no checking in both `src/lib/db.ts` and `src/lib/sources.ts`. That
  is survivable while it is read once at first run. Anything that reads it repeatedly must
  validate first.
- **Check every consumer before changing shared behaviour.** The one real bug shipped this
  session came from changing `cleanDuplicateCoffees`'s grouping on an assumption about the
  data that turned out false.
- **Verify in calling context, not in isolation.** Unit tests passed on that change; the
  failure only showed when the real parser output was fed to the real SQL.

## Context worth keeping

- 310 sources: 214 Shopify `.atom`, 52 Squarespace `?format=rss`, 44 WordPress variants.
- `Blueprint Coffee` and `Oddly Correct` are each registered twice with different feed
  endpoints, so both double-post. Resolving that is an owner action in `/owner/feeds`, not
  code.
- `Ally Coffee`'s stored website is `https://www.allycoffee.com/our-coffees/#respond`, a
  WordPress comment anchor. Cosmetic, untouched, and out of scope for a names-only module.
