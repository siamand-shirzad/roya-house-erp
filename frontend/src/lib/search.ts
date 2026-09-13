import { toLatinDigits } from "@/lib/csv";

// Search text as people actually type it: Persian or Latin digits, Arabic or
// Persian yeh/kaf (Arabic keyboards and pasted text use the Arabic forms),
// zero-width non-joiners, and any capitalisation.
export function normalizeSearch(text: string): string {
  return toLatinDigits(text)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when every word of the query appears somewhere in the haystack. */
export function matchesSearch(haystack: string, query: string): boolean {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeSearch(haystack);
  return words.every((w) => text.includes(w));
}
