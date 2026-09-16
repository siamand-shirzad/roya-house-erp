// Gregorian -> Jalali (Shamsi), the same public-domain algorithm as
// frontend/src/lib/format.ts. Used by the Sepidar exports, which expect
// Shamsi dates written as 1405/06/25.

const div = (a: number, b: number) => ~~(a / b);

export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const gDm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  let days =
    365 * gy2 +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0) && gm > 2 ? gd + gDm[gm - 1] + 1 : gd + gDm[gm - 1]) -
    80;
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

/** "1405/06/25" for a timestamp, read as a Tehran calendar day. */
export function jalaliDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  // Shift to Tehran's wall clock (UTC+03:30; Iran dropped DST in 2022) so the day is right on a UTC server.
  const tehran = new Date(d.getTime() + 3.5 * 3600_000);
  const local = new Date(tehran.getUTCFullYear(), tehran.getUTCMonth(), tehran.getUTCDate());
  const { jy, jm, jd } = toJalali(local);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

/** "1405/06/25" for a calendar day given as "YYYY-MM-DD" (a Postgres `date`). */
export function jalaliDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const { jy, jm, jd } = toJalali(new Date(y, m - 1, d));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}
