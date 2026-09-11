// Formatting helpers for Persian/Farsi business documents.

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/**
 * Digit style for the whole UI and the printed documents. Latin digits are
 * rendered by the Latin number fonts (Inter / Space Grotesk); flip this to go
 * back to Persian digits everywhere.
 */
const USE_PERSIAN_DIGITS = false;

/** Digits as displayed: Latin (default) or Persian, per USE_PERSIAN_DIGITS. */
export function toDisplayDigits(input: string | number): string {
  const s = String(input);
  return USE_PERSIAN_DIGITS ? s.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]) : s;
}

/** Format a Toman amount with thousands separators, e.g. 1234567 -> "1,234,567". */
export function formatToman(amount: number): string {
  return toDisplayDigits(Math.round(amount).toLocaleString("en-US"));
}

/** Format a Rial amount (Toman * 10), matching how the paper templates print totals. */
export function formatRial(tomanAmount: number): string {
  return formatToman(tomanAmount * 10);
}

/** Format a plain number (quantities) with Persian digits, no currency. */
export function formatNumber(n: number): string {
  const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return toDisplayDigits(rounded.toLocaleString("en-US"));
}

const GREGORIAN_EPOCH = 1948321; // JDN adjustments for Jalali conversion
const JALALI_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function div(a: number, b: number) {
  return ~~(a / b);
}

/** Gregorian -> Jalali (Shamsi) date conversion (public-domain algorithm). */
export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy2Days =
    365 * gy2 +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0) && gm > 2 ? gd + g_d_m[gm - 1] + 1 : gd + g_d_m[gm - 1]) -
    80;

  let days = gy2Days;
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/** Format a JS Date as a Jalali date string "1405/06/11". */
export function formatJalaliDate(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return toDisplayDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}

export function formatJalaliDateLong(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  const weekday = JALALI_WEEKDAYS[date.getDay()];
  return `${weekday} ${toDisplayDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toDisplayDigits(jy)}`;
}
