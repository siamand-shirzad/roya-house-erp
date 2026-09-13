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

/** Short Toman for chart axes: 35,000,000 -> "35 م", 250,000 -> "250 هزار". */
export function formatTomanCompact(value: number): string {
  if (value >= 1_000_000) return `${toDisplayDigits(Math.round(value / 100_000) / 10)} م`;
  if (value >= 1_000) return `${toDisplayDigits(Math.round(value / 1_000))} هزار`;
  return toDisplayDigits(value);
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

/** Jalali (Shamsi) -> Gregorian, the inverse of toJalali (same public-domain source). Local midnight. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  const y = jy + 1595;
  let days =
    -355668 + 365 * y + div(y, 33) * 8 + div((y % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const monthDays = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > monthDays[gm]; gm++) gd -= monthDays[gm];
  return new Date(gy, gm - 1, gd);
}

/** "شهریور 1405" */
export function formatJalaliMonth(jy: number, jm: number): string {
  return `${JALALI_MONTHS[jm - 1]} ${toDisplayDigits(jy)}`;
}

/** Local calendar date as YYYY-MM-DD (no UTC shift, unlike toISOString). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatJalaliDateLong(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  const weekday = JALALI_WEEKDAYS[date.getDay()];
  return `${weekday} ${toDisplayDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toDisplayDigits(jy)}`;
}
