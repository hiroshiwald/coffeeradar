const ORIGINS = [
  "ethiopia", "colombi", "kenya", "guatemala", "costa rica", "panama",
  "brazil", "rwanda", "burundi", "peru", "mexico", "honduras", "el salvador",
  "nicaragua", "bolivia", "congo", "tanzania", "uganda", "indonesia",
  "sumatra", "java", "sulawesi", "yemen", "india", "geisha", "gesha",
  "yirgacheffe", "sidamo", "guji", "huehuetenango", "antigua", "nyeri",
  "kiambu", "murang", "kirinyaga", "nariño", "huila", "cauca", "tolima",
  "cerrado", "mogiana", "tarrazu", "chiriqui", "boquete",
];

const PROCESS_MAP: [RegExp, string][] = [
  [/\bco[\s-]?ferment/i, "Co-Ferment"],
  [/\bcarbonic\s*maceration/i, "Co-Ferment"],
  [/\banaerobic/i, "Anaerobic"],
  [/\bhoney/i, "Honey"],
  [/\bnatural/i, "Natural"],
  [/\bwashed/i, "Washed"],
];

const NOTE_PATTERNS = [
  /(?:tasting\s*)?notes?\s*(?:of|:)\s*([^.<]+)/i,
  /flavou?rs?\s*(?:of|:)\s*([^.<]+)/i,
  /taste\s*(?:of|:)\s*([^.<]+)/i,
];

const NOTE_WORDS = new Set([
  "chocolate", "caramel", "vanilla", "honey", "brown sugar", "molasses",
  "toffee", "butterscotch", "cocoa", "berry", "blueberry", "strawberry",
  "raspberry", "blackberry", "cherry", "cranberry", "citrus", "lemon",
  "lime", "orange", "grapefruit", "tangerine", "mandarin", "peach",
  "apricot", "plum", "apple", "pear", "grape", "mango", "papaya",
  "pineapple", "tropical", "passion fruit", "guava", "lychee", "melon",
  "fig", "date", "raisin", "prune", "floral", "jasmine", "rose",
  "lavender", "hibiscus", "bergamot", "chamomile", "nutty", "almond",
  "hazelnut", "walnut", "peanut", "pecan", "cashew", "cedar", "tobacco",
  "leather", "earthy", "spice", "cinnamon", "clove", "cardamom", "ginger",
  "black tea", "green tea", "wine", "winey", "whiskey", "rum",
  "milk chocolate", "dark chocolate", "white chocolate", "stone fruit",
  "red fruit", "dried fruit", "candied", "syrupy", "silky", "creamy",
  "juicy", "bright", "clean", "complex", "balanced", "sweet",
  "blackcurrant", "currant", "nougat", "praline", "maple",
  "tomato", "tamarind", "cola", "root beer",
]);

export function detectType(text: string): "Single Origin" | "Blend" | "Unknown" {
  const lower = text.toLowerCase();
  if (/\bblend\b/i.test(lower)) return "Blend";
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

export function extractNotes(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  // Try structured patterns first
  for (const pattern of NOTE_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const parts = match[1].split(/[,&]+/).map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (p.length > 1 && p.length < 30) found.add(capitalize(p));
      }
    }
  }

  // Also scan for known note words
  for (const word of NOTE_WORDS) {
    if (lower.includes(word)) found.add(capitalize(word));
  }

  return Array.from(found).slice(0, 6);
}

export function extractPrice(text: string): string {
  // Shopify s:price element value
  const priceMatch = text.match(/[\$£€]?\s?(\d{1,3}(?:\.\d{2}))/);
  if (priceMatch) {
    const num = parseFloat(priceMatch[1]);
    if (num > 5 && num < 200) return `$${num.toFixed(2)}`;
  }
  return "";
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
