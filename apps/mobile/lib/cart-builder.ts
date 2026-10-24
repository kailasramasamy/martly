import type { CartBuilderResult } from "@martly/shared/types";
import type { StoreProduct } from "./types";

/** Grocery words the speech recogniser tends to mishear ("toor dal" as "to dal"); passed as recognition hints */
export const LIST_HINTS = [
  "toor dal", "urad dal", "moong dal", "chana dal", "masoor dal", "ponni rice", "idli rice", "basmati rice", "sona masoori",
  "rava", "maida", "besan", "atta", "ragi", "semiya", "poha", "jaggery", "gingelly oil", "groundnut oil", "sunflower oil",
  "coconut oil", "ghee", "paneer", "curd", "buttermilk", "curry leaves", "coriander", "green chilli", "ginger", "garlic",
  "tamarind", "turmeric powder", "chilli powder", "sambar powder", "rasam powder", "mustard seeds", "cumin", "fenugreek",
  "asafoetida", "cardamom", "detergent", "dishwash bar", "agarbatti", "Aachi", "Sakthi", "Aashirvaad", "Gold Winner",
  "Idhayam", "Tata Sampann", "Fortune", "Aavin", "Arokya", "Hatsun", "Britannia", "Parle-G", "Horlicks", "Boost",
  "kilo", "half kg", "half kilo", "half litre", "quarter kg", "kaal kilo", "arai kilo", "mukkaal kilo", "litre", "packet",
  "அரிசி", "பருப்பு", "துவரம் பருப்பு", "உளுந்து", "கடலைப்பருப்பு", "சர்க்கரை", "வெல்லம்", "உப்பு", "நல்லெண்ணெய்",
  "கடலை எண்ணெய்", "தேங்காய் எண்ணெய்", "நெய்", "பால்", "தயிர்", "கறிவேப்பிலை", "கொத்தமல்லி", "பச்சை மிளகாய்", "இஞ்சி",
  "பூண்டு", "வெங்காயம்", "தக்காளி", "புளி", "மஞ்சள் தூள்", "மிளகாய் தூள்", "கடுகு", "சீரகம்", "ரவை", "மைதா", "சேமியா",
  "கால் கிலோ", "அரை கிலோ", "முக்கால் கிலோ", "லிட்டர்", "பாக்கெட்",
];

/** A spoken or written list matched against the store (POST /list-to-cart) */
export type BuiltCart = CartBuilderResult<StoreProduct>;
export type BuiltLine = BuiltCart["lines"][number];

/** A list under review as it streams in: each line's words first, its products (`line`) once found */
export interface ReviewLineEntry {
  /** Stable across re-searches of other lines; a re-searched line gets a new one */
  key: string;
  text: string;
  item: string;
  /** The words as first read from the list, kept when the shopper re-words the line (My list ticks items off by them) */
  said: string;
  line: BuiltLine | null;
}

export interface ReviewState {
  runId: string | null;
  lines: ReviewLineEntry[];
  /** My list: the items the list was built from */
  itemIds?: string[];
  /** A line was re-worded, so the run no longer matches what's on screen */
  edited?: boolean;
}

/** Every size of every product offered for a line, best product first, each product's suggested size first */
export function lineProducts(line: BuiltLine): StoreProduct[] {
  return line.candidates.flatMap((c) => [c.storeProduct, ...c.sizes]);
}

/** What of a line is in the cart: the first of its products there, and how many */
export function lineInCart(line: BuiltLine, quantities: Map<string, number>) {
  const sp = lineProducts(line).find((p) => (quantities.get(p.id) ?? 0) > 0);
  return sp ? { sp, quantity: quantities.get(sp.id)! } : null;
}
