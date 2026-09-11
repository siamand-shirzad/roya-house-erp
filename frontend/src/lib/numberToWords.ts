// Persian (Farsi) number-to-words, used for the "جمع کل: ... ریال" line
// on the printed documents, the same way the original paper templates spell
// totals out in words.

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = [
  "ده",
  "یازده",
  "دوازده",
  "سیزده",
  "چهارده",
  "پانزده",
  "شانزده",
  "هفده",
  "هجده",
  "نوزده",
];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = [
  "",
  "صد",
  "دویست",
  "سیصد",
  "چهارصد",
  "پانصد",
  "ششصد",
  "هفتصد",
  "هشتصد",
  "نهصد",
];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  const parts: string[] = [];
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred) parts.push(HUNDREDS[hundred]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const ten = Math.floor(rest / 10);
    const one = rest % 10;
    if (ten) parts.push(TENS[ten]);
    if (one) parts.push(ONES[one]);
  }
  return parts.join(" و ");
}

/** Convert a non-negative integer into Persian words, e.g. 350000000 -> "سیصد و پنجاه میلیون". */
export function numberToPersianWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "صفر";

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.unshift(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  const offset = groups.length - 1;
  groups.forEach((group, idx) => {
    if (group === 0) return;
    const scale = SCALES[offset - idx];
    const groupWords = threeDigitsToWords(group);
    words.push(scale ? `${groupWords} ${scale}` : groupWords);
  });

  return words.join(" و ");
}

/** Spell out a Toman amount as Rial words, matching the paper templates
 * ("جمع کل: سیصد و پنجاه میلیون ریال"). */
export function tomanToRialWords(tomanAmount: number): string {
  return `${numberToPersianWords(tomanAmount * 10)} ریال`;
}
