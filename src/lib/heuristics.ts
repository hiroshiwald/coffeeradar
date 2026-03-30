const ORIGINS = [
  "ethiopia", "colombi", "kenya", "guatemala", "costa rica", "panama",
  "brazil", "rwanda", "burundi", "peru", "mexico", "honduras", "el salvador",
  "nicaragua", "bolivia", "congo", "tanzania", "uganda", "indonesia",
  "sumatra", "java", "sulawesi", "yemen", "india", "geisha", "gesha",
  "yirgacheffe", "sidamo", "guji", "huehuetenango", "antigua", "nyeri",
  "kiambu", "murang", "kirinyaga", "nariño", "huila", "cauca", "tolima",
  "cerrado", "mogiana", "tarrazu", "chiriqui", "boquete",
  "kochere", "chelchele", "worka", "bensa", "gedeb", "shakiso",
  "nayarita", "chiapas", "oaxaca", "veracruz",
  "aceh", "flores", "papua", "bali",
  "doi chang", "chiang mai", "chiang rai",
  "yunnan", "laos", "myanmar", "vietnam",
];

const PROCESS_MAP: [RegExp, string][] = [
  [/\bco[\s-]?ferment/i, "Co-Ferment"],
  [/\bcarbonic\s*maceration/i, "Co-Ferment"],
  [/\banaerobic\s*natural/i, "Anaerobic Natural"],
  [/\banaerobic/i, "Anaerobic"],
  [/\byellow\s*honey/i, "Yellow Honey"],
  [/\bred\s*honey/i, "Red Honey"],
  [/\bblack\s*honey/i, "Black Honey"],
  [/\bhoney\s*process/i, "Honey"],
  [/\bhoney/i, "Honey"],
  [/\bnatural/i, "Natural"],
  [/\bfully\s*washed/i, "Washed"],
  [/\bwashed/i, "Washed"],
  [/\bwet[\s-]?hull/i, "Wet Hulled"],
];

const NOTE_PATTERNS = [
  /(?:tasting\s*)?notes?\s*(?:of|:|-)\s*([^.<\n]+)/gi,
  /flavou?rs?\s*(?:of|:|-)\s*([^.<\n]+)/gi,
  /taste\s*(?:of|:|-)\s*([^.<\n]+)/gi,
  /cupping\s*(?:notes?|score)?\s*(?:of|:|-)\s*([^.<\n]+)/gi,
  /we\s*taste\s*([^.<\n]+)/gi,
  /expect\s*([^.<\n]+)/gi,
];

const NOTE_WORDS = new Set([
  // Chocolate family
  "chocolate", "cocoa", "cacao", "milk chocolate", "dark chocolate",
  "white chocolate", "baker's chocolate", "fudge", "brownie",
  // Caramel/sugar family
  "caramel", "toffee", "butterscotch", "brown sugar", "molasses",
  "maple", "maple syrup", "honey", "vanilla", "nougat", "praline",
  "marshmallow", "cotton candy", "dulce de leche",
  // Berry family
  "berry", "blueberry", "strawberry", "raspberry", "blackberry",
  "cherry", "cranberry", "boysenberry", "mulberry", "black cherry",
  "red currant", "blackcurrant", "currant", "jam", "preserves",
  // Citrus family
  "citrus", "lemon", "lime", "orange", "grapefruit", "tangerine",
  "mandarin", "clementine", "yuzu", "blood orange", "lemonade",
  "marmalade", "zest",
  // Stone fruit
  "peach", "apricot", "plum", "nectarine", "stone fruit",
  // Tropical fruit
  "mango", "papaya", "pineapple", "tropical", "passion fruit",
  "guava", "lychee", "melon", "watermelon", "banana", "coconut",
  "jackfruit", "starfruit", "dragon fruit",
  // Pome fruit
  "apple", "pear", "grape", "green apple", "red apple",
  // Dried fruit
  "fig", "date", "raisin", "prune", "dried fruit", "red fruit",
  // Floral
  "floral", "jasmine", "rose", "lavender", "hibiscus", "bergamot",
  "chamomile", "elderflower", "orange blossom", "honeysuckle",
  "violet", "lilac", "geranium",
  // Nutty
  "nutty", "almond", "hazelnut", "walnut", "peanut", "pecan",
  "cashew", "macadamia", "pistachio", "roasted nuts",
  // Spice
  "spice", "cinnamon", "clove", "cardamom", "ginger", "black pepper",
  "white pepper", "allspice", "nutmeg", "star anise", "anise",
  // Earthy/woody
  "cedar", "tobacco", "leather", "earthy", "woody", "oak",
  "sandalwood", "pine", "smoky",
  // Tea/herbal
  "black tea", "green tea", "earl grey", "oolong", "herbal",
  "mint", "eucalyptus", "sage", "thyme", "rosemary",
  // Wine/fermented
  "wine", "winey", "whiskey", "rum", "brandy", "port",
  "red wine", "white wine", "champagne", "sparkling",
  // Texture/mouthfeel
  "candied", "syrupy", "silky", "creamy", "juicy", "buttery",
  "velvety", "round", "smooth", "crisp", "tea-like",
  // Character
  "bright", "clean", "complex", "balanced", "sweet", "tangy",
  "tart", "vibrant", "delicate", "rich", "bold", "mellow",
  "refined", "elegant", "funky", "wild",
  // Other
  "tomato", "tamarind", "cola", "root beer",
  "sugarcane", "milk", "cream", "yogurt",
]);

const MERCH_KEYWORDS = [
  "sweatshirt", "hoodie", "t-shirt", "tee shirt", "shirt", "tank top",
  "sticker", "decal", "patch", "pin", "enamel pin",
  "mug", "cup", "tumbler", "thermos", "flask", "bottle", "water bottle",
  "beanie", "hat", "cap", "snapback", "trucker hat",
  "tote", "tote bag", "bag", "backpack", "pouch",
  "gift card", "gift set", "subscription", "class", "workshop",
  "grinder", "brewer", "kettle", "dripper", "filter", "scale",
  "candle", "soap", "poster", "print", "book", "zine",
  "chocolate bar", "syrup", "oat milk",
];

const MERCH_PRODUCT_TYPES = [
  "apparel", "clothing", "accessories", "merchandise", "merch",
  "gift", "equipment", "gear", "drinkware", "brewing",
];

export function isMerchandise(title: string, productType: string, tags: string[]): boolean {
  const lower = `${title} ${productType} ${tags.join(" ")}`.toLowerCase();

  // Check product type first
  for (const pt of MERCH_PRODUCT_TYPES) {
    if (lower.includes(pt)) return true;
  }

  // Check title against merch keywords
  const titleLower = title.toLowerCase();
  for (const kw of MERCH_KEYWORDS) {
    if (titleLower.includes(kw)) return true;
  }

  return false;
}

export function detectType(text: string): "Single Origin" | "Blend" | "Unknown" {
  const lower = text.toLowerCase();
  if (/\bblend\b/i.test(lower)) return "Blend";
  // Check Shopify product type
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

export function extractNotes(text: string, shopifyTags: string[]): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  // Extract from Shopify tags — these are often the most reliable
  for (const tag of shopifyTags) {
    const tagLower = tag.toLowerCase().trim();
    if (NOTE_WORDS.has(tagLower)) {
      found.add(capitalize(tagLower));
    }
  }

  // Try structured patterns (use all matches, not just first)
  for (const pattern of NOTE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const parts = match[1].split(/[,;&/]+|\band\b/).map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        const cleaned = p.replace(/\s+/g, " ").trim();
        if (cleaned.length > 1 && cleaned.length < 30) {
          // Check if it's a known note or close to one
          if (NOTE_WORDS.has(cleaned)) {
            found.add(capitalize(cleaned));
          } else {
            // Check each word in multi-word matches
            for (const word of NOTE_WORDS) {
              if (cleaned.includes(word)) found.add(capitalize(word));
            }
          }
        }
      }
    }
  }

  // Scan for known note words in full text
  for (const word of NOTE_WORDS) {
    if (lower.includes(word)) found.add(capitalize(word));
  }

  // Remove texture/character descriptors if we have enough flavor notes
  const flavorNotes = Array.from(found);
  const textureWords = new Set([
    "Bright", "Clean", "Complex", "Balanced", "Sweet", "Juicy",
    "Silky", "Creamy", "Syrupy", "Buttery", "Round", "Smooth",
    "Crisp", "Vibrant", "Delicate", "Rich", "Bold", "Mellow",
    "Refined", "Elegant", "Tangy", "Tart", "Tea-Like", "Velvety",
    "Candied", "Funky", "Wild",
  ]);

  const flavors = flavorNotes.filter((n) => !textureWords.has(n));
  if (flavors.length >= 3) return flavors.slice(0, 6);
  return flavorNotes.slice(0, 6);
}

export function extractPrice(text: string): string {
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
