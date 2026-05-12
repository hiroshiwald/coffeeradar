import {
  ORIGINS,
  PROCESS_MAP,
  NOTE_PATTERNS,
  NOTE_WORDS,
  TEXTURE_NOTE_WORDS,
  MERCH_KEYWORDS,
  MERCH_PRODUCT_TYPES,
} from "./heuristicsData";

export function isMerchandise(title: string, productType: string, tags: string[]): boolean {
  const lower = `${title} ${productType} ${tags.join(" ")}`.toLowerCase();

  for (const pt of MERCH_PRODUCT_TYPES) {
    if (lower.includes(pt)) return true;
  }

  const titleLower = title.toLowerCase();
  for (const kw of MERCH_KEYWORDS) {
    if (titleLower.includes(kw)) return true;
  }

  return false;
}

export function detectType(text: string): "Single Origin" | "Blend" | "Unknown" {
  const lower = text.toLowerCase();
  if (/\bblend\b/i.test(lower)) return "Blend";
  if (/\bsingle[\s-]?origin\b/i.test(lower)) return "Single Origin";
  for (const origin of ORIGINS) {
    if (lower.includes(origin)) return "Single Origin";
  }
  return "Unknown";
}

export function detectProcess(text: string): string {
  for (const [pattern, label] of PROCESS_MAP) {
    if (pattern.test(text)) return label;
  }
  return "";
}

// Split a free-form note segment ("blueberry, dark chocolate and honey")
// into trimmed candidate tokens.
export function tokenizeNotesSegment(segment: string): string[] {
  return segment
    .split(/[,;&/]+|\band\b/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// Drop tokens that aren't useful as note candidates (too short/long).
export function filterNoiseTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.length > 1 && t.length < 30);
}

// Title-case a note for display ("brown sugar" -> "Brown Sugar").
export function normalizeNoteCase(token: string): string {
  return token.replace(/\b\w/g, (c) => c.toUpperCase());
}

function collectNotesFromTags(tags: string[], found: Set<string>): void {
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    if (NOTE_WORDS.has(tagLower)) {
      found.add(normalizeNoteCase(tagLower));
    }
  }
}

function collectNotesFromPatterns(lower: string, found: Set<string>): void {
  for (const pattern of NOTE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(lower)) !== null) {
      const candidates = filterNoiseTokens(tokenizeNotesSegment(match[1]));
      for (const cleaned of candidates) {
        if (NOTE_WORDS.has(cleaned)) {
          found.add(normalizeNoteCase(cleaned));
          continue;
        }
        // Within an explicit tasting-notes segment only, allow whole-word
        // subword matches so "dark chocolate" yields "Chocolate". Never run
        // this against arbitrary body copy.
        for (const sub of cleaned.split(/\s+/)) {
          if (NOTE_WORDS.has(sub)) found.add(normalizeNoteCase(sub));
        }
      }
    }
  }
}

export function extractNotes(text: string, shopifyTags: string[]): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  collectNotesFromTags(shopifyTags, found);
  collectNotesFromPatterns(lower, found);

  const all = Array.from(found);
  const flavors = all.filter((n) => !TEXTURE_NOTE_WORDS.has(n));
  if (flavors.length >= 3) return flavors.slice(0, 6);
  return all.slice(0, 6);
}

export function extractPrice(text: string): string {
  const currencyMatches = text.matchAll(/(?:US\$|C\$|A\$|[$£€])\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/g);
  for (const match of currencyMatches) {
    const candidate = match[1];
    if (!candidate) continue;
    const num = parseFloat(candidate.replace(/,/g, ""));
    if (num > 0 && num < 2000) return `$${num.toFixed(2)}`;
  }

  const decimalMatches = text.matchAll(/\b(\d{1,4}\.\d{2})\b/g);
  for (const match of decimalMatches) {
    const candidate = match[1];
    if (!candidate) continue;
    const num = parseFloat(candidate);
    if (num > 5 && num < 2000) return `$${num.toFixed(2)}`;
  }

  return "";
}
