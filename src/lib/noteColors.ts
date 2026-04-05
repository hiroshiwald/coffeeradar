const NOTE_COLORS: Record<string, string> = {};

const FAMILIES: [string, string[]][] = [
  ["bg-rose-100 dark:bg-rose-900/25 text-rose-700 dark:text-rose-300", [
    "berry", "blueberry", "strawberry", "raspberry", "blackberry", "cherry",
    "cranberry", "boysenberry", "mulberry", "black cherry", "red currant",
    "blackcurrant", "currant", "jam", "preserves", "red fruit",
  ]],
  ["bg-amber-100 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300", [
    "citrus", "lemon", "lime", "orange", "grapefruit", "tangerine",
    "mandarin", "clementine", "yuzu", "blood orange", "lemonade",
    "marmalade", "zest",
  ]],
  ["bg-orange-100 dark:bg-orange-900/25 text-orange-700 dark:text-orange-300", [
    "mango", "papaya", "pineapple", "tropical", "passion fruit", "guava",
    "lychee", "melon", "watermelon", "banana", "coconut", "jackfruit",
    "starfruit", "dragon fruit",
  ]],
  ["bg-pink-100 dark:bg-pink-900/25 text-pink-700 dark:text-pink-300", [
    "peach", "apricot", "plum", "nectarine", "stone fruit",
    "apple", "pear", "grape", "green apple", "red apple",
    "fig", "date", "raisin", "prune", "dried fruit",
  ]],
  ["bg-yellow-100 dark:bg-yellow-900/25 text-yellow-800 dark:text-yellow-300", [
    "chocolate", "cocoa", "cacao", "milk chocolate", "dark chocolate",
    "white chocolate", "fudge", "brownie", "baker's chocolate",
  ]],
  ["bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200", [
    "caramel", "toffee", "butterscotch", "brown sugar", "molasses",
    "maple", "maple syrup", "honey", "vanilla", "nougat", "praline",
    "marshmallow", "cotton candy", "dulce de leche", "sugarcane",
  ]],
  ["bg-violet-100 dark:bg-violet-900/25 text-violet-700 dark:text-violet-300", [
    "floral", "jasmine", "rose", "lavender", "hibiscus", "bergamot",
    "chamomile", "elderflower", "orange blossom", "honeysuckle",
    "violet", "lilac", "geranium",
  ]],
  ["bg-stone-200 dark:bg-stone-800/40 text-stone-700 dark:text-stone-300", [
    "nutty", "almond", "hazelnut", "walnut", "peanut", "pecan",
    "cashew", "macadamia", "pistachio", "roasted nuts",
  ]],
  ["bg-red-100 dark:bg-red-900/25 text-red-700 dark:text-red-300", [
    "spice", "cinnamon", "clove", "cardamom", "ginger", "black pepper",
    "white pepper", "allspice", "nutmeg", "star anise", "anise",
  ]],
  ["bg-emerald-100 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300", [
    "black tea", "green tea", "earl grey", "oolong", "herbal",
    "mint", "eucalyptus", "sage", "thyme", "rosemary", "tea-like",
  ]],
  ["bg-purple-100 dark:bg-purple-900/25 text-purple-700 dark:text-purple-300", [
    "wine", "winey", "whiskey", "rum", "brandy", "port",
    "red wine", "white wine", "champagne", "sparkling",
  ]],
  ["bg-slate-200 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300", [
    "cedar", "tobacco", "leather", "earthy", "woody", "oak",
    "sandalwood", "pine", "smoky",
  ]],
];

for (const [cls, words] of FAMILIES) {
  for (const w of words) NOTE_COLORS[w.toLowerCase()] = cls;
}

const DEFAULT_NOTE_COLOR = "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300";

export function getNoteColor(note: string): string {
  return NOTE_COLORS[note.toLowerCase()] ?? DEFAULT_NOTE_COLOR;
}
