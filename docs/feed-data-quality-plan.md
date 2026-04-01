# Feed Data Quality Diagnosis & Plan

## Diagnosis (as of 2026-04-01)

The feed pipeline was dropping prices and images for many non-Shopify feeds due to parser assumptions:

1. **Object-valued text fields were stringified directly**
   - Several Atom/RSS feeds provide `title`, `summary`, or `description` as nested objects (e.g. with `#text`, `@_type`, namespaced children).
   - The parser used `String(field)` in those paths, yielding `"[object Object]"` in records.
   - This corrupted product names and removed text that price/image extraction depends on.

2. **Price extraction was too narrow and too Shopify-centric**
   - We primarily relied on Shopify tags (`s:price`, `s:variant`) and plain text extraction.
   - Feeds using `g:price`, `price`, or `woocommerce:price` were not consistently parsed.

3. **Image extraction did not cover enough feed/HTML variants**
   - The parser handled Shopify and a few media tags, but missed common patterns in RSS/Atom content:
     - `content:encoded`
     - `og:image` meta tags
     - lazy-loaded image attributes (`data-src`, `srcset`)
     - `itunes:image` style attributes

4. **Atom links could be arrays and not always handled robustly**
   - Some feeds provide multiple `<link>` entries and the parser could fallback to the roaster website incorrectly.

## Plan to Ensure All Records Include Price + Image (Best-Effort)

### Phase 1 — Parser hardening (implemented)

- Normalize nested XML values with recursive text extraction before classification.
- Expand direct price key detection to include `g:price`, `price`, `woocommerce:price`, `p:price`.
- Expand image extraction for `content:encoded`, `og:image`, `data-src`, `srcset`, `itunes:image`.
- Improve Atom link extraction for array/object/string shapes.

### Phase 2 — Add feed-level quality checks

- During refresh, compute per-source metrics:
  - total entries
  - `% with non-empty price`
  - `% with non-empty imageUrl`
  - count of malformed titles (e.g. `"[object Object]"`)
- Persist these metrics per source and expose them in `/api/sources` and admin UI.
- Highlight low-quality sources (e.g. <70% price/image completeness).

### Phase 3 — Source adapters (targeted, no new project)

- Add optional source-specific adapters for known non-standard feeds that still fail generic parsing.
- Keep adapters in this repo only (e.g., `src/lib/adapters/*`) and gated by source URL/domain.

### Phase 4 — Validation gates

- Add lightweight integration checks (script or test) that parse fixture feeds and assert:
  - title is not `"[object Object]"`
  - price parse rate above threshold
  - image parse rate above threshold
- Run checks in CI before deploy.

### Phase 5 — Operational maintenance

- Add admin action to re-fetch a single source and inspect parsed sample rows.
- Maintain a small fixture corpus for each feed style (Shopify, WP, custom RSS, Google Merchant).
- Review failing feeds weekly and either fix generic parser or add a scoped adapter.

## Success Criteria

- `"[object Object]"` titles reduced to zero.
- Price completeness >95% for coffee entries where feed includes price data.
- Image completeness >95% for entries where feed includes image URLs or embedded media.
- Source-level quality dashboard identifies regressions within one refresh cycle.
